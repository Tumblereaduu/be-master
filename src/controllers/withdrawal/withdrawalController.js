const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
const multer = require("multer");
const path = require('path');
const cloudinary = require('../../config/cloudinary');

// Multer configuration 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed!'));
  }
});

const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    const initialTimeout = 120000;

    const attemptUpload = () => {
      attempts++;
      const sanitizedFolder = folder.trim().replace(/[^a-zA-Z0-9-_]/g, '_');

      const uploadOptions = {
        folder: `withdrawal/${sanitizedFolder}`,
        resource_type: 'auto',
        timeout: initialTimeout + (attempts * 30000),
        public_id: `${filename}_${Date.now()}`,
        overwrite: false
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            if (attempts < maxAttempts && (error.message.includes('timeout') || error.http_code === 499)) {
              setTimeout(attemptUpload, 3000 * attempts);
            } else {
              reject(new Error(`Cloudinary upload failed after ${attempts} attempts: ${error.message}`));
            }
          } else {
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.on('error', (streamError) => {
        if (attempts < maxAttempts) {
          setTimeout(attemptUpload, 3000 * attempts);
        } else {
          reject(streamError);
        }
      });

      const timeoutId = setTimeout(() => {
        uploadStream.destroy(new Error('Custom timeout exceeded'));
      }, uploadOptions.timeout);

      uploadStream.on('finish', () => clearTimeout(timeoutId));
      uploadStream.end(fileBuffer);
    };

    attemptUpload();
  });
};

const withdrawalPaymentUpload = upload.single('qr_payment_screenshot');


// ===== Create Withdrawal =====
const createWithdrawal = async (req, res) => {
  try {
    const {
      user_id, username, email, payment_method,
      requested_amount_usd, transfer_amount_usd,
      payment_address_upi_id,
      bank_account_holder_name, bank_account_number, bank_ifsc_code,
      bank_name, bank_branch_name, country, withdrawal_source
    } = req.body;

    if (!user_id || !username || !email || !payment_method || !requested_amount_usd || !transfer_amount_usd) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_FIELDS',
        message: ERROR_MESSAGES.MISSING_FIELDS
      });
    }

    // Validate withdrawal source - must be either 'website' or 'mobile_app'
    const ALLOWED_SOURCES = ["website", "mobile_app"];
    const normalizedSource = withdrawal_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validSource = ALLOWED_SOURCES.includes(normalizedSource) ? normalizedSource : "website";

    // Check active trades
    const [activeTrades] = await queryDatabase(
      `SELECT trade_id FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
      [user_id]
    );
    if (activeTrades.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "You have active positions. Complete them and re-initiate your withdrawal.",
      });
    }

    // Fetch wallet
    const [user] = await queryDatabase(
      `SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
      [user_id]
    );
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentBalance = parseFloat(user[0].wallet);
    if (currentBalance < requested_amount_usd) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    // Deduct
    const newBalance = currentBalance - requested_amount_usd;
    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet = ? WHERE user_id = ?`,
      [newBalance, user_id]
    );

    // Upload screenshot
    let qr_payment_screenshot = null;
    if (req.file) {
      try {
        qr_payment_screenshot = await uploadToCloudinary(req.file.buffer, user_id, req.file.originalname);
      } catch (error) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to upload the QR screenshot',
          error: error.message
        });
      }
    }

    // Payment method validation
    if (payment_method === "bank_transfer") {
      if (!bank_account_holder_name || !bank_account_number || !bank_ifsc_code || !bank_name || !bank_branch_name || !country) {
        return res.status(400).json({ status: 'error', message: 'Missing bank details for bank transfer' });
      }
    } else if (payment_method === "upi") {
      if (!payment_address_upi_id) {
        return res.status(400).json({ status: 'error', message: 'Missing UPI ID for UPI payment' });
      }
    }

    // Fee calculation
    const [settings] = await queryDatabase(
      `SELECT withdrawal_fee FROM ${TABLES.ADMIN_PANEL_RATE_SETTINGS} LIMIT 1`
    );
    if (!settings || settings.length === 0) {
      return res.status(500).json({ status: "error", message: "Withdrawal fee is not found in Admin panel" });
    }
    const fee_percentage = parseFloat(settings[0].withdrawal_fee);
    const fee = parseFloat((requested_amount_usd * (fee_percentage / 100)).toFixed(2));

    // Insert — UTC_TIMESTAMP() stores UTC, and with timezone:'Z' in db.js, reads back as UTC
    const sql = `
      INSERT INTO ${TABLES.USER_WITHDRAWAL_TRANSACTION} (
        user_id, username, email, payment_method, requested_amount_usd, transfer_amount_usd,
        fee, fee_percentage, payment_address_upi_id,
        bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch_name, country,
        qr_payment_screenshot, withdrawal_status, withdrawal_request_at, withdrawal_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP(), ?)
    `;

    const result = await queryDatabase(sql, [
      user_id, username, email, payment_method,
      requested_amount_usd, transfer_amount_usd || null,
      fee, fee_percentage, payment_address_upi_id || null,
      bank_account_holder_name || null, bank_account_number || null,
      bank_ifsc_code || null, bank_name || null, bank_branch_name || null,
      country || null, qr_payment_screenshot, validSource
    ]);

    console.log("Withdrawal Inserted:", result.insertId, "Source:", validSource);

    res.json({
      status: "success",
      message: SUCCESS_MESSAGES.WITHDRAWAL_CREATED,
      withdrawal_id: result.insertId,
      qr_payment_screenshot,
      withdrawal_source: validSource
    });

  } catch (error) {
    console.error("Failed to create withdrawal:", error);
    res.status(500).json({
      status: "error",
      message: ERROR_MESSAGES.WITHDRAWAL_CREATION_FAILED,
      error: error.message
    });
  }
};


// ===== Get All Withdrawals =====
const getWithdrawals = async (req, res) => {
  try {
    const sql = `
      SELECT w.withdrawal_id, w.user_id, w.username, w.email, w.payment_method,
             w.requested_amount_usd, w.transfer_amount_usd,
             w.fee, w.fee_percentage, w.payment_address_upi_id, w.withdrawal_status,
             DATE_FORMAT(w.withdrawal_verified_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_verified_at,
             DATE_FORMAT(w.withdrawal_request_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_request_at,
             v.is_lp_added, w.verified_by_admin_id, w.verified_by_admin_name, w.withdrawal_source
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} w
      JOIN ${TABLES.REGISTER} v ON w.user_id = v.id
      ORDER BY w.withdrawal_request_at DESC
    `;
    const [rows] = await queryDatabase(sql);
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch withdrawals:", error);
    res.status(500).json({
      status: "error",
      message: ERROR_MESSAGES.WITHDRAWAL_FETCH_FAILED,
      error: error.message
    });
  }
};


// ===== Get Withdrawals by User ID =====
const getWithdrawalByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const sql = `
      SELECT user_id, withdrawal_id, payment_method, withdrawal_status,
             requested_amount_usd, transfer_amount_usd, payment_address_upi_id,
             DATE_FORMAT(withdrawal_request_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_request_at,
             withdrawal_reject_reason, withdrawal_source
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION}
      WHERE user_id = ?
      AND is_hidden = 0
      ORDER BY withdrawal_request_at DESC
    `;
    const [rows] = await queryDatabase(sql, [userId]);
    res.json({ withdraw: rows });
  } catch (error) {
    console.error("Failed to fetch user Withdrawals", error);
    res.status(500).json({ status: "error", message: "Failed to fetch withdrawals for user", error: error.message });
  }
};

// ===== Get Admin Withdrawals by User ID =====
const getAdminWithdrawalByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const sql = `
      SELECT user_id, withdrawal_id, payment_method, withdrawal_status, is_hidden,
             requested_amount_usd, transfer_amount_usd, payment_address_upi_id,
             DATE_FORMAT(withdrawal_request_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_request_at,
             withdrawal_reject_reason, withdrawal_source
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION}
      WHERE user_id = ?
      ORDER BY withdrawal_request_at DESC
    `;
    const [rows] = await queryDatabase(sql, [userId]);
    res.json({ withdraw: rows });
  } catch (error) {
    console.error("Failed to fetch user Withdrawals", error);
    res.status(500).json({ status: "error", message: "Failed to fetch withdrawals for user", error: error.message });
  }
};


// ===== Get Single Withdrawal by ID =====
const getWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT withdrawal_id, user_id, username, email, payment_method,
             requested_amount_usd, transfer_amount_usd,
             fee, fee_percentage, payment_address_upi_id, qr_payment_screenshot,
             withdrawal_status, withdrawal_reject_reason,
             DATE_FORMAT(withdrawal_verified_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_verified_at,
             bank_account_holder_name, bank_account_number, bank_ifsc_code,
             bank_name, bank_branch_name, country,
             DATE_FORMAT(withdrawal_request_at, '%Y-%m-%d %H:%i:%s') AS withdrawal_request_at,
             verified_by_admin_id, verified_by_admin_name, withdrawal_source
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION}
      WHERE withdrawal_id = ?
    `;
    const [rows] = await queryDatabase(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: ERROR_MESSAGES.WITHDRAWAL_NOT_FOUND });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Failed to fetch withdrawal:", error);
    res.status(500).json({ status: "error", message: ERROR_MESSAGES.WITHDRAWAL_FETCH_FAILED, error: error.message });
  }
};


// ===== Update Withdrawal Status =====
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      withdrawal_status, withdrawal_reject_reason,
      verified_by_admin_id, verified_by_admin_name,
      username, payment_method, currency_name, transaction_id,
      enter_amount, requested_amount_usd, transfer_amount_usd,
      fee_percentage, fee, bank_name, bank_account_number,
      bank_holder_name, withdrawal_request_at,
      edited_by_admin_id, edited_by_admin_name,
    } = req.body;

    if (!withdrawal_status) {
      return res.status(400).json({ status: "error", message: ERROR_MESSAGES.WITHDRAWAL_UPDATE_FAILED });
    }

    // Fetch existing withdrawal
    const [rows] = await queryDatabase(
      `SELECT w.withdrawal_id, w.transfer_amount_usd, w.requested_amount_usd, w.user_id, u.email AS user_email, u.username
       FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} w
       JOIN ${TABLES.REGISTER} u ON w.user_id = u.id
       WHERE w.withdrawal_id = ?`,
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Withdrawal record not found." });
    }

    const withdrawal = rows[0];
    const user_id = withdrawal.user_id;
    const refundAmount = parseFloat(requested_amount_usd ?? withdrawal.requested_amount_usd);

    // Refund on rejection
    if (withdrawal_status === "rejected") {
      const [userWallet] = await queryDatabase(
        `SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
        [user_id]
      );
      if (!userWallet || userWallet.length === 0) {
        return res.status(404).json({ success: false, message: "User wallet not found." });
      }
      const currentBalance = parseFloat(userWallet[0].wallet);
      await queryDatabase(
        `UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet = ? WHERE user_id = ?`,
        [currentBalance + refundAmount, user_id]
      );
    }

    // ✅ FIX: Pure string conversion — NO new Date()
    let formattedWithdrawalRequestAt = null;
    if (withdrawal_request_at) {
      if (withdrawal_request_at.includes('T')) {
        const [datePart, timePart] = withdrawal_request_at.split('T');
        const [hours, minutes] = timePart.split(':');
        formattedWithdrawalRequestAt = `${datePart} ${hours}:${minutes}:00`;
      } else {
        formattedWithdrawalRequestAt = withdrawal_request_at;
      }
    }

    // Build dynamic UPDATE
    const setClauses = [];
    const values = [];

    setClauses.push("withdrawal_status = ?");
    values.push(withdrawal_status);

    setClauses.push("withdrawal_reject_reason = ?");
    values.push(withdrawal_reject_reason || null);

    setClauses.push(`withdrawal_verified_at = CASE WHEN ? IN ('completed', 'rejected') THEN UTC_TIMESTAMP() ELSE withdrawal_verified_at END`);
    values.push(withdrawal_status);

    setClauses.push("verified_by_admin_id = ?");
    values.push(verified_by_admin_id || null);

    setClauses.push("verified_by_admin_name = ?");
    values.push(verified_by_admin_name || null);

    // Editable fields — only add if provided
    const editableFields = {
      username, payment_method, currency_name, transaction_id,
      enter_amount, requested_amount_usd, transfer_amount_usd,
      fee_percentage, fee, bank_name, bank_account_number, bank_holder_name
    };

    for (const [key, val] of Object.entries(editableFields)) {
      if (val !== undefined && val !== null) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      }
    }

    // ✅ Datetime — only update if admin actually changed it
    if (formattedWithdrawalRequestAt !== null) {
      setClauses.push("withdrawal_request_at = ?");
      values.push(formattedWithdrawalRequestAt);
    }

    values.push(id);

    const sql = `
      UPDATE ${TABLES.USER_WITHDRAWAL_TRANSACTION}
      SET ${setClauses.join(", ")}
      WHERE withdrawal_id = ?
    `;

    const [result] = await queryDatabase(sql, values);

    console.log(`Withdrawal ${id} updated — affectedRows: ${result.affectedRows}, changedRows: ${result.changedRows}`);

    res.json({ status: "success", message: SUCCESS_MESSAGES.WITHDRAWAL_UPDATED });

  } catch (error) {
    console.error("Failed to update withdrawal:", error);
    res.status(500).json({ status: "error", message: ERROR_MESSAGES.WITHDRAWAL_UPDATE_FAILED, error: error.message });
  }
};

const hideWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.USER_WITHDRAWAL_TRANSACTION}
             SET is_hidden = 1,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE withdrawal_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Withdrawal hidden successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const restoreWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.USER_WITHDRAWAL_TRANSACTION}
             SET is_hidden = 0,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE withdrawal_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Withdrawal restored successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
  withdrawalPaymentUpload,
  createWithdrawal,
  getWithdrawals,
  getWithdrawalById,
  updateWithdrawalStatus,
  getWithdrawalByUserId,
  getAdminWithdrawalByUserId,
  hideWithdrawal,
  restoreWithdrawal
};

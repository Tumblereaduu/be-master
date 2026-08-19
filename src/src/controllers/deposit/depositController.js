// depositController.js
const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
const multer = require('multer');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
// const {getDepositEmail} = require('../../utils/email');

// Multer configuartion
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// Cloudinary upload with sanitized folder name
const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    const initialTimeout = 120000; // 120 seconds

    const attemptUpload = () => {
      attempts++;
      console.log(`Attempt ${attempts} for ${filename}`);

      // Sanitize folder name: trim whitespace and replace invalid characters
      const sanitizedFolder = folder.trim().replace(/[^a-zA-Z0-9-_]/g, '_');

      const uploadOptions = {
        folder: `deposits/${sanitizedFolder}`,
        resource_type: 'auto',
        timeout: initialTimeout + (attempts * 30000),
        public_id: `${filename}_${Date.now()}`,
        overwrite: false
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error(`Upload attempt ${attempts} failed:`, error.message);
            if (attempts < maxAttempts && (error.message.includes('timeout') || error.http_code === 499)) {
              setTimeout(attemptUpload, 3000 * attempts); // Progressive delay
            } else {
              reject(new Error(`Cloudinary upload failed after ${attempts} attempts: ${error.message}`));
            }
          } else {
            console.log(`Upload successful on attempt ${attempts}`);
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.on('error', (streamError) => {
        console.error(`Stream error on attempt ${attempts}:`, streamError.message);
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


const depositPaymentUpload = upload.single('payment_screenshot');

// Initalize the deposit request
const createDeposit = async (req, res) => {
  try {
    const {
      user_id,
      username,
      email,
      payment_method,
      transaction_id,
      enter_amount,
      upi_id,
      usdt_address,
      bank_account_number,
      bank_holder_name,
      bank_name,
      deposit_source
    } = req.body;
 const ALLOWED_PAYMENT_METHODS = ["upi", "usdt", "bitcoin", "usdttrc20", "usdterc20", "bank_transfer"];
     const normalizedMethod = payment_method?.trim().toLowerCase().replace(/\s+/g, "_");
     if (!ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payment method"
        });
      }

    // Validate deposit source - must be either 'website' or 'mobile_app'
    const ALLOWED_SOURCES = ["website", "mobile_app"];
    const normalizedSource = deposit_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validSource = ALLOWED_SOURCES.includes(normalizedSource) ? normalizedSource : "website";

    // Validate required fields
    if (!user_id || !username || !email || !payment_method || !transaction_id || !enter_amount) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_FIELDS',
        message: ERROR_MESSAGES.MISSING_FIELDS,
      });
    }

    // Upload screenshot (optional but recommended)
    let payment_screenshot = null;
    if (req.file) {
      try {
        const fileBuffer = req.file.buffer;
        const originalName = req.file.originalname;
        console.log(`Uploading payment_screenshot (${req.file.size} bytes)`);

        payment_screenshot = await uploadToCloudinary(fileBuffer, user_id, originalName);
        console.log(`Successfully uploaded payment_screenshot: ${payment_screenshot}`);
      } catch (uploadError) {
        console.error('Error uploading payment_screenshot:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload payment screenshot',
          error: uploadError.message
        });
      }
    }

    // --- Currency & Fee Calculation ---
    const enterAmountNum = parseFloat(enter_amount);
    const settingsQuery = `SELECT inr_value,deposit_fee FROM ${TABLES.ADMIN_PANEL_RATE_SETTINGS} LIMIT 1`
    const [settings] = await queryDatabase(settingsQuery);

    if(!settings){
      return res.status(500).json({
          status:"error",
          message:"Deposit Admin table not found",
      });
    }
      const feePercentage = parseFloat(settings[0].deposit_fee);

    const fee = (enterAmountNum * (feePercentage / 100)).toFixed(2);
    const rate = parseFloat(settings[0].inr_value);  // 1 USD = 90 INR (example rate)

    let currency_name = "INR";
    let requested_amount_usd = null;
    let transfer_amount_usd = null;

    // const normalizedMethod = payment_method.trim().toLowerCase().replace(/\s+/g, "_");

    if (normalizedMethod === "usdt" || normalizedMethod === "bitcoin" || normalizedMethod === "usdttrc20" || normalizedMethod === "usdterc20" ) {
      currency_name = "USD";
      requested_amount_usd = enterAmountNum;
      transfer_amount_usd = (enterAmountNum - fee).toFixed(2);
    } else if (["upi", "bank_transfer"].includes(normalizedMethod)) {
      currency_name = "INR";
      requested_amount_usd = (enterAmountNum / rate).toFixed(2);
      const fee_usd = (fee / rate).toFixed(2);
      transfer_amount_usd = (requested_amount_usd - fee_usd).toFixed(2);
    }

    // --- SQL Insert ---
    const query = `
      INSERT INTO ${TABLES.USER_DEPOSIT_TRANSACTION} 
      (user_id, username, email, payment_method, currency_name, transaction_id, enter_amount,
       requested_amount_usd, transfer_amount_usd, fee, fee_percentage,
       deposit_request_at, deposit_status, deposit_reject_reason, deposit_verified_at,
       upi_id, usdt_address, bank_account_number, bank_holder_name, bank_name, payment_screenshot, deposit_source) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Pending', NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await queryDatabase(query, [
      user_id,
      username,
      email,
      payment_method,
      currency_name,
      transaction_id,
      enterAmountNum,
      requested_amount_usd,
      transfer_amount_usd,
      fee,
      feePercentage,
      upi_id || null,
      usdt_address || null,
      bank_account_number || null,
      bank_holder_name || null,
      bank_name || null,
      payment_screenshot,
      validSource
    ]);
    console.log("Deposit Inserted:", result.insertId, "Source:", validSource );

    res.json({
      status: "success",
      message: SUCCESS_MESSAGES.DEPOSIT_CREATED,
      deposit_id: result.insertId,
      payment_screenshot,
      deposit_source: validSource
    });

    } catch (error) {
      console.error("Failed to create deposit:", error);
     res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.DEPOSIT_CREATION_FAILED,
            error: error.message
        });
    }
  };

// Fetch deposit by ID
const getDepositById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT deposit_id, user_id, username, payment_method, currency_name, transaction_id,
                 enter_amount, requested_amount_usd, transfer_amount_usd, fee, fee_percentage, payment_screenshot,
                 deposit_request_at, deposit_status, deposit_reject_reason, deposit_verified_at,
                 upi_id, usdt_address, bank_account_number, bank_holder_name, bank_name,
                 verified_by_admin_id, verified_by_admin_name, deposit_source
                 FROM ${TABLES.USER_DEPOSIT_TRANSACTION}
                 WHERE deposit_id = ?`;

    const [rows] = await queryDatabase(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Deposit not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Failed to fetch deposit by ID:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch deposit",
      error: error.message,
    });
  }
};

// Fetch deposits list by user ID
const getDepositsByUserId = async (req, res) => {

  try {
    const { id } = req.params
    const sql = `SELECT
        deposit_id,
        user_id,
        payment_method,
        transaction_id,
        transfer_amount_usd,
        enter_amount,
        requested_amount_usd,
        deposit_status,
        DATE_FORMAT(
            deposit_request_at,
            '%Y-%m-%d %H:%i:%s'
        ) AS deposit_request_at,
        deposit_reject_reason,
        deposit_source
    FROM ${TABLES.USER_DEPOSIT_TRANSACTION}
    WHERE user_id = ?
    AND is_hidden = 0
    ORDER BY deposit_request_at DESC
    `;
    const [rows] = await queryDatabase(sql, [id])

    const totalAmount = rows.reduce((sum, dep) => sum + Number(dep.transfer_amount_usd), 0)

    res.json({
      deposit: rows,
      totalAmount
    })
  } catch (error) {
    console.error("Failed to fetch the error", error);
    res.status(500).json({ status: "error", message: error.message })

  }
}

// Fetch Admin deposits list by user ID
const getAdminDepositsByUserId = async (req, res) => {

  try {
    const { id } = req.params
    const sql = `SELECT
        deposit_id,
        user_id,
        payment_method,
        transaction_id,
        transfer_amount_usd,
        enter_amount,
        requested_amount_usd,
        deposit_status,
        is_hidden,
        DATE_FORMAT(
            deposit_request_at,
            '%Y-%m-%d %H:%i:%s'
        ) AS deposit_request_at,
        deposit_reject_reason,
        deposit_source
    FROM ${TABLES.USER_DEPOSIT_TRANSACTION}
    WHERE user_id = ?
    ORDER BY deposit_request_at DESC
    `;
    const [rows] = await queryDatabase(sql, [id])

    const totalAmount = rows.reduce((sum, dep) => sum + Number(dep.transfer_amount_usd), 0)

    res.json({
      deposit: rows,
      totalAmount
    })
  } catch (error) {
    console.error("Failed to fetch the error", error);
    res.status(500).json({ status: "error", message: error.message })

  }
}

// Fetch all deposits
const getAllDepositList = async (req, res) => {
    try {
        const sql = `SELECT o.deposit_id, o.user_id, o.username, o.email, o.payment_method, o.currency_name, o.transaction_id,
             o.enter_amount, o.requested_amount_usd, o.transfer_amount_usd, o.fee, o.fee_percentage,
             o.deposit_request_at, o.deposit_status, o.deposit_reject_reason, o.deposit_verified_at,
             o.upi_id, o.usdt_address, o.bank_account_number, o.bank_holder_name, o.bank_name, u.is_lp_added,
             o.verified_by_admin_id, o.verified_by_admin_name, o.deposit_source
      FROM ${TABLES.USER_DEPOSIT_TRANSACTION} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id ORDER BY o.deposit_request_at  DESC`

        const [rows] = await queryDatabase(sql)
        res.json(rows);
    } catch (error) {
        console.error("Failed to fetch deposit", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.DEPOSIT_FETCH_FAILED,
            error: error.message,
        })
    }
}

// Update deposit by ID
const updateDepositByID = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            deposit_status, 
            deposit_reject_reason, 
            verified_by_admin_id, 
            verified_by_admin_name,
            // Editable fields
            username,
            payment_method,
            currency_name,
            transaction_id,
            enter_amount,
            requested_amount_usd,
            transfer_amount_usd,
            fee_percentage,
            fee,
            bank_name,
            bank_account_number,
            bank_holder_name,
            deposit_request_at,
            edited_by_admin_id,
            edited_by_admin_name
        } = req.body;

        // Always require deposit_status
        if (!deposit_status) {
            return res.status(400).json({
                status: "error",
                message: ERROR_MESSAGES.MISSING_FIELDS,
            })
        }

        // Log what backend received for debugging
        console.log("=== BACKEND RECEIVED UPDATE FOR DEPOSIT ID:", id, "===");
        console.log("enter_amount received:", enter_amount, typeof enter_amount);
        console.log("transfer_amount_usd received:", transfer_amount_usd, typeof transfer_amount_usd);
        console.log("requested_amount_usd received:", requested_amount_usd, typeof requested_amount_usd);
        console.log("fee_percentage received:", fee_percentage, typeof fee_percentage);
        console.log("fee received:", fee, typeof fee);
        console.log("username received:", username);
        console.log("transaction_id received:", transaction_id);
        console.log("deposit_request_at received:", deposit_request_at);
        console.log("================================================");

         // Fetch deposit + user details
        const [rows] = await queryDatabase(
          `
            SELECT 
              d.deposit_id,
              d.transfer_amount_usd,
              d.user_id,
              u.email AS user_email,
              u.username
            FROM ${TABLES.USER_DEPOSIT_TRANSACTION} d
            JOIN ${TABLES.REGISTER} u ON d.user_id = u.id
            WHERE d.deposit_id = ?
          `,
          [id]
        );

        if (!rows || rows.length === 0) {
          return res.status(404).json({
            status: "error",
            message: "Deposit record not found."
          });
        }

        const deposit = rows[0];


        let formattedDepositRequestAt = deposit_request_at;

        if (deposit_request_at) {
            const d = new Date(deposit_request_at);

            formattedDepositRequestAt =
              d.getFullYear() +
              "-" +
              String(d.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(d.getDate()).padStart(2, "0") +
              " " +
              String(d.getHours()).padStart(2, "0") +
              ":" +
              String(d.getMinutes()).padStart(2, "0") +
              ":" +
              String(d.getSeconds()).padStart(2, "0");
        }

        // Build dynamic SET clauses
        const setClauses = [];
        const values = [];

        // Status fields — always include
        setClauses.push('deposit_status = ?');
        values.push(deposit_status);

        setClauses.push('deposit_reject_reason = ?');
        values.push(deposit_reject_reason || null);

        setClauses.push(`deposit_verified_at = CASE WHEN ? IN ('completed', 'rejected') THEN NOW() ELSE deposit_verified_at END`);
        values.push(deposit_status);

        setClauses.push('verified_by_admin_id = ?');
        values.push(verified_by_admin_id || null);

        setClauses.push('verified_by_admin_name = ?');
        values.push(verified_by_admin_name || null);

        // Editable fields — only add if explicitly sent (not null/undefined)
        if (username !== undefined && username !== null) {
            setClauses.push('username = ?');
            values.push(username);
        }
        if (payment_method !== undefined && payment_method !== null) {
            setClauses.push('payment_method = ?');
            values.push(payment_method);
        }
        if (currency_name !== undefined && currency_name !== null) {
            setClauses.push('currency_name = ?');
            values.push(currency_name);
        }
        if (transaction_id !== undefined && transaction_id !== null) {
            setClauses.push('transaction_id = ?');
            values.push(transaction_id);
        }
        if (enter_amount !== undefined && enter_amount !== null) {
            setClauses.push('enter_amount = ?');
            values.push(enter_amount);
        }
        if (requested_amount_usd !== undefined && requested_amount_usd !== null) {
            setClauses.push('requested_amount_usd = ?');
            values.push(requested_amount_usd);
        }
        if (transfer_amount_usd !== undefined && transfer_amount_usd !== null) {
            setClauses.push('transfer_amount_usd = ?');
            values.push(transfer_amount_usd);
        }
        if (fee_percentage !== undefined && fee_percentage !== null) {
            setClauses.push('fee_percentage = ?');
            values.push(fee_percentage);
        }
        if (fee !== undefined && fee !== null) {
            setClauses.push('fee = ?');
            values.push(fee);
        }
        if (formattedDepositRequestAt !== undefined && formattedDepositRequestAt !== null) {
            setClauses.push('deposit_request_at = ?');
            values.push(formattedDepositRequestAt);
        }
        if (bank_name !== undefined && bank_name !== null) {
            setClauses.push('bank_name = ?');
            values.push(bank_name);
        }
        if (bank_account_number !== undefined && bank_account_number !== null) {
            setClauses.push('bank_account_number = ?');
            values.push(bank_account_number);
        }
        if (bank_holder_name !== undefined && bank_holder_name !== null) {
            setClauses.push('bank_holder_name = ?');
            values.push(bank_holder_name);
        }

        // WHERE id
        values.push(id);

        const sql = `
            UPDATE ${TABLES.USER_DEPOSIT_TRANSACTION}
            SET ${setClauses.join(', ')}
            WHERE deposit_id = ?
        `;

        console.log("=== FINAL SQL ===");
        console.log(sql);
        console.log("VALUES:", values);
        console.log("==================");

        const [result] = await queryDatabase(sql, values);

        console.log("=== UPDATE RESULT ===");
        console.log("affectedRows:", result.affectedRows);
        console.log("changedRows:", result.changedRows);
        console.log("====================");

        // Log who edited
        if (edited_by_admin_id || edited_by_admin_name) {
            console.log(`Deposit ${id} details edited by admin: ${edited_by_admin_name || edited_by_admin_id}`);
        }

        res.json({
            status: "success",
            message: SUCCESS_MESSAGES.DEPOSIT_UPDATED
        })

        // email
        // await getDepositEmail({
        //   toEmail: deposit.user_email,
        //   username: deposit.username,
        //   amount: deposit.transfer_amount_usd,
        //   status: deposit_status,
        //   reject_reason: deposit_reject_reason || null,
        // });
    } catch (error) {
        console.error("Failed to update deposit:", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.DEPOSIT_UPDATE_FAILED,
            error: error.message,
        });
    }
};

const hideDeposit = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.USER_DEPOSIT_TRANSACTION}
             SET is_hidden = 1,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE deposit_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Deposit hidden successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const restoreDeposit = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.USER_DEPOSIT_TRANSACTION}
             SET is_hidden = 0,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE deposit_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Deposit restored successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = { createDeposit, depositPaymentUpload, getAllDepositList, updateDepositByID, getDepositById, getDepositsByUserId, getAdminDepositsByUserId, hideDeposit, restoreDeposit };

const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const multer = require('multer');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
// const { sq } = require("date-fns/locale");

// Multer configuration
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
  },
});

// Cloudinary upload helper
const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;
    const initialTimeout = 120000;

    const attemptUpload = () => {
      attempts++;
      console.log(`Attempt ${attempts} for ${filename}`);

      const sanitizedFolder = folder.trim().replace(/[^a-zA-Z0-9-_]/g, '_');

      const uploadOptions = {
        folder: `admin_payment_mode_settings/${sanitizedFolder}`,
        resource_type: 'auto',
        timeout: initialTimeout + attempts * 30000,
        public_id: `${filename}_${Date.now()}`,
        overwrite: false,
      };

      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          console.error(`Upload attempt ${attempts} failed:`, error.message);
          if (attempts < maxAttempts && (error.message.includes('timeout') || error.http_code === 499)) {
            setTimeout(attemptUpload, 3000 * attempts);
          } else {
            reject(new Error(`Cloudinary upload failed after ${attempts} attempts: ${error.message}`));
          }
        } else {
          console.log(`Upload successful on attempt ${attempts}`);
          resolve(result.secure_url);
        }
      });

      uploadStream.end(fileBuffer);
    };

    attemptUpload();
  });
};

// Multer middleware for Upload document uploads
const paymentUpload = upload.fields([{ name: 'qr_code', maxCount: 1 }]);

const paymentMode = async (req, res) => {
  try {
    const {
      payment_mode,
      nickname,
      address,
      deposit_status,
      withdrawal_status,
      bank_account_number,
      bank_ifsc_code,
      bank_account_name,
      bank_name,
      bank_postal_code,
      bank_city,
      country,
      is_used,
    } = req.body;

    let qrCodeUrl = null;


    //  Helper to handle [rows, fields] results from MySQL
    const normalizeDB = (result) => {
      if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
      return result;
    };


    //  Upload QR code if provided
    if (req.files?.qr_code?.[0]) {
      const file = req.files.qr_code[0];
      qrCodeUrl = await uploadToCloudinary(file.buffer, "payment_modes", file.originalname);
      console.log("QR uploaded:", qrCodeUrl);
    }
    // UPI (Allow Multiple Records)
    if (payment_mode?.toLowerCase() === "upi") {

          // If Deposit is Active -> Deactivate all other UPI deposit statuses
          if (deposit_status === "active") {
              await queryDatabase(
                  `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
                  SET deposit_status = 'inactive'
                  WHERE LOWER(payment_mode) = 'upi'`
              );
          }

          // If Withdrawal is Active -> Deactivate all other UPI withdrawal statuses
          if (withdrawal_status === "active") {
              await queryDatabase(
                  `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
                  SET withdrawal_status = 'inactive'
                  WHERE LOWER(payment_mode) = 'upi'`
              );
          }

        await queryDatabase(
            `INSERT INTO ${TABLES.PAYMENT_METHOD_ADMIN}
            (
                payment_mode,
                nickname,
                qr_code,
                address,
                deposit_status,
                withdrawal_status,
                is_used,
                created_at,
                updated_at
            )
            VALUES(?,?,?,?,?,?,?,NOW(),NOW())`,
            [
                "upi",
                nickname || null,
                qrCodeUrl,
                address,
                deposit_status || "inactive",
                withdrawal_status || "inactive",
                "inactive"
            ]
        );

        return res.status(200).json({
            success: true,
            message: "UPI Added Successfully"
        });
    }


    // USDT / BTC / TRC20 / ERC20 (Single Record)
    if (payment_mode && ["usdt", "usdttrc20", "usdterc20", "bitcoin"].includes(payment_mode.toLowerCase())) {
      let existing = await queryDatabase(
        `SELECT id FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE LOWER(payment_mode) = LOWER(?) LIMIT 1`,
        [payment_mode]
      );

      existing = normalizeDB(existing);

      if (existing.length > 0) {
        //  Update existing
        const updateSql = `
          UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
          SET
            address = ?,
            ${qrCodeUrl ? "qr_code = ?," : ""}
            deposit_status = ?,
            withdrawal_status = ?,
            updated_at = NOW()
          WHERE id = ?
        `;
        const params = qrCodeUrl
          ? [address, qrCodeUrl, deposit_status, withdrawal_status, existing[0].id]
          : [address, deposit_status, withdrawal_status, existing[0].id];

        await queryDatabase(updateSql, params);
        return res.status(200).json({ success: true, message: `${payment_mode} updated successfully` });
      } else {
        //  Insert new
        await queryDatabase(
          `INSERT INTO ${TABLES.PAYMENT_METHOD_ADMIN} 
          (payment_mode, qr_code, address, deposit_status, withdrawal_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [payment_mode, qrCodeUrl, address, deposit_status, withdrawal_status]
        );
        return res.status(200).json({ success: true, message: `${payment_mode} added successfully` });
      }
    }

    //  Step 2: BANK_TRANSFER — handle multiple records
    if (payment_mode === "bank_transfer") {
      let existingBank = await queryDatabase(
        `SELECT id FROM ${TABLES.PAYMENT_METHOD_ADMIN} 
         WHERE payment_mode = ? AND bank_account_number = ? AND bank_ifsc_code = ? 
         LIMIT 1`,
        [payment_mode, bank_account_number, bank_ifsc_code]
      );
      existingBank = normalizeDB(existingBank);

      if (existingBank.length > 0) {
        //  Update
        const updateSql = `
          UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
          SET
            bank_account_name = ?,
            bank_name = ?,
            bank_postal_code = ?,
            bank_city = ?,
            country = ?,
            deposit_status = ?,
            withdrawal_status = ?,
            ${qrCodeUrl ? "qr_code = ?," : ""}
            updated_at = NOW()
          WHERE id = ?
        `;
        const params = qrCodeUrl
          ? [bank_account_name, bank_name, bank_postal_code, bank_city, country,
            deposit_status, withdrawal_status, qrCodeUrl, existingBank[0].id]
          : [bank_account_name, bank_name, bank_postal_code, bank_city, country,
            deposit_status, withdrawal_status, existingBank[0].id];

        await queryDatabase(updateSql, params);
        return res.status(200).json({ success: true, message: `Bank account updated successfully` });
      }

      // Insert new
      await queryDatabase(
        `INSERT INTO ${TABLES.PAYMENT_METHOD_ADMIN}
        (payment_mode, qr_code, address, deposit_status, withdrawal_status,
         bank_account_number, bank_ifsc_code, bank_account_name, bank_name,
         bank_postal_code, bank_city, country, is_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          payment_mode,
          qrCodeUrl,
          address || null,
          deposit_status || "inactive",
          withdrawal_status || "inactive",
          bank_account_number || null,
          bank_ifsc_code || null,
          bank_account_name || null,
          bank_name || null,
          bank_postal_code || null,
          bank_city || null,
          country || null,
          is_used || "inactive",
        ]
      );
      return res.status(200).json({ success: true, message: `Bank account added successfully` });
    }

    //  If none of the above
    return res.status(400).json({ success: false, message: "Invalid payment mode" });
  } catch (error) {
    console.error("Error saving payment mode:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving payment mode",
      error: error.message,
    });
  }
};


const getAllpaymentMode = async (req, res) => {
  try {
    const { payment_mode } = req.query;

    let sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN}`;
    let params = [];

    if (payment_mode) {
      sql += ` WHERE LOWER(payment_mode) = LOWER(?)`;
      params.push(payment_mode);
    }

    sql += ` ORDER BY id DESC`;

    const data = await queryDatabase(sql, params);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching payment modes:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// Get single payment mode by ID
const getPaymentModeById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE id = ? `;
    const data = await queryDatabase(sql, [id]);

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment mode not found",
      });
    }

    res.status(200).json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    console.error("Error fetching payment mode by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// get details by payment mode

const getPaymentByParams = async (req, res) => {
  try {
    const rawMode = req.query.payment_mode || req.params.payment_mode;
    const payment_mode = rawMode ? rawMode.trim().toLowerCase().replace(" ", "_") : null;
    const account_number = req.query.account_number || req.params.account_number;
    const type = req.query.type || req.params.type; // "deposit" or "withdrawal"

    if (!payment_mode) {
      return res.status(400).json({
        success: false,
        message: "Payment mode is required",
      });
    }

    let sql, params;

    //  Fetch bank transfer by account number
   if (payment_mode === "bank_transfer") {
      if (account_number) {
        sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE payment_mode = ? AND bank_account_number = ? AND is_used = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1`;
        params = [payment_mode, account_number];
      } else {
        sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE payment_mode = ? AND is_used = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1`;
        params = [payment_mode];
      }
    }
    //  Fetch USDT/UPI/BTC - Filter by active status based on transaction type
    else {
      if (type === "withdrawal") {
        sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE payment_mode = ? AND withdrawal_status = 'active' LIMIT 1`;
        params = [payment_mode];
      } else if (type === "deposit") {
        sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE payment_mode = ? AND deposit_status = 'active' LIMIT 1`;
        params = [payment_mode];
      } else {
        // Fallback: Return first active record (deposit preferred over withdrawal)
        sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE payment_mode = ? AND (deposit_status = 'active' OR withdrawal_status = 'active') LIMIT 1`;
        params = [payment_mode];
      }
    }

    const data = await queryDatabase(sql, params);

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Payment method not found" });
    }

    return res.status(200).json({ success: true, data: data[0] });

  } catch (error) {
    console.error("Error in getPaymentByParams:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Active and Inactive

const getActivePaymentModes = async (req, res) => {
  try {
    const { type } = req.query; // "deposit" or "withdrawal"
    let sql;

    if (type === "withdrawal") {
      sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE withdrawal_status = 'active' ORDER BY id DESC`;
    } else if (type === "deposit") {
      sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} WHERE deposit_status = 'active' ORDER BY id DESC`;
    } else {
      sql = `SELECT * FROM ${TABLES.PAYMENT_METHOD_ADMIN} ORDER BY id DESC`;
    }

    const result = await queryDatabase(sql);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching active payment modes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// In your controller file, e.g., paymentController.js

const toggleIsUsed = async (req, res) => {
  try {
    const { id } = req.params;

    // Find selected record
    let payment = await queryDatabase(
      `SELECT id, payment_mode
       FROM ${TABLES.PAYMENT_METHOD_ADMIN}
       WHERE id = ?`,
      [id]
    );

    if (Array.isArray(payment) && Array.isArray(payment[0])) {
      payment = payment[0];
    }

    if (!payment.length) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const paymentMode = payment[0].payment_mode.toLowerCase();

    // Deactivate all records of same payment mode
    await queryDatabase(
      `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
       SET is_used='inactive'
       WHERE LOWER(payment_mode)=LOWER(?)`,
      [paymentMode]
    );

    // Activate selected record
    await queryDatabase(
      `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
       SET is_used='active',
           updated_at=NOW()
       WHERE id=?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `${paymentMode.toUpperCase()} activated successfully`,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const deletePaymentMode = async(req,res)=>{

    try{

        const {id}=req.params;

        await queryDatabase(
        `DELETE FROM ${TABLES.PAYMENT_METHOD_ADMIN}
         WHERE id=?`,
        [id]);

        res.json({
            success:true,
            message:"Deleted Successfully"
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });

    }

}

const updatePaymentMode = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      payment_mode,
      nickname,
      address,
      deposit_status,
      withdrawal_status,
      bank_account_number,
      bank_ifsc_code,
      bank_account_name,
      bank_name,
      bank_postal_code,
      bank_city,
      country,
    } = req.body;

    let qrCodeUrl = null;

    if (req.files?.qr_code?.[0]) {
      const file = req.files.qr_code[0];

      qrCodeUrl = await uploadToCloudinary(
        file.buffer,
        "payment_modes",
        file.originalname
      );
    }

    // -------------------------
    // UPI / USDT / BTC / ERC20 / TRC20
    // -------------------------
    if (
      ["upi", "usdt", "bitcoin", "usdterc20", "usdttrc20"].includes(
        payment_mode.toLowerCase()
      )
    ) {

        // Only for UPI
  if (payment_mode.toLowerCase() === "upi") {

    // Only one UPI Deposit can be Active
    if (deposit_status === "active") {
      await queryDatabase(
        `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
         SET deposit_status = 'inactive'
         WHERE LOWER(payment_mode) = 'upi'
         AND id != ?`,
        [id]
      );
    }

    // Only one UPI Withdrawal can be Active
    if (withdrawal_status === "active") {
      await queryDatabase(
        `UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
         SET withdrawal_status = 'inactive'
         WHERE LOWER(payment_mode) = 'upi'
         AND id != ?`,
        [id]
      );
    }
  }

      let sql = `
        UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
        SET
          nickname = ?,
          address = ?,
          deposit_status = ?,
          withdrawal_status = ?,
      `;

      const params = [
        nickname || null,
        address,
        deposit_status,
        withdrawal_status,
      ];

      if (qrCodeUrl) {
        sql += ` qr_code = ?, `;
        params.push(qrCodeUrl);
      }

      sql += `
          updated_at = NOW()
        WHERE id = ?
      `;

      params.push(id);

      await queryDatabase(sql, params);

      return res.status(200).json({
        success: true,
        message: `${payment_mode.toUpperCase()} updated successfully`,
      });
    }

    // -------------------------
    // BANK TRANSFER
    // -------------------------
    if (payment_mode === "bank_transfer") {
      let sql = `
        UPDATE ${TABLES.PAYMENT_METHOD_ADMIN}
        SET
          bank_account_number = ?,
          bank_ifsc_code = ?,
          bank_account_name = ?,
          bank_name = ?,
          bank_postal_code = ?,
          bank_city = ?,
          country = ?,
          deposit_status = ?,
          withdrawal_status = ?,
      `;

      const params = [
        bank_account_number,
        bank_ifsc_code,
        bank_account_name,
        bank_name,
        bank_postal_code,
        bank_city,
        country,
        deposit_status,
        withdrawal_status,
      ];

      if (qrCodeUrl) {
        sql += ` qr_code = ?, `;
        params.push(qrCodeUrl);
      }

      sql += `
          updated_at = NOW()
        WHERE id = ?
      `;

      params.push(id);

      await queryDatabase(sql, params);

      return res.status(200).json({
        success: true,
        message: "Bank updated successfully",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid payment mode",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const getAdminPaymentByParams = async (req, res) => {
  try {
    const rawMode = req.query.payment_mode || req.params.payment_mode;
    const payment_mode = rawMode
      ? rawMode.trim().toLowerCase().replace(" ", "_")
      : null;

    const account_number =
      req.query.account_number || req.params.account_number;

    if (!payment_mode) {
      return res.status(400).json({
        success: false,
        message: "Payment mode is required",
      });
    }

    let sql;
    let params;

    // UPI & Bank Transfer -> Return all records
    if (payment_mode === "upi" || payment_mode === "bank_transfer") {
      sql = `
        SELECT *
        FROM ${TABLES.PAYMENT_METHOD_ADMIN}
        WHERE payment_mode = ?
        ORDER BY updated_at DESC, id DESC
      `;

      params = [payment_mode];

      // Optional: filter by account number for bank
      if (payment_mode === "bank_transfer" && account_number) {
        sql = `
          SELECT *
          FROM ${TABLES.PAYMENT_METHOD_ADMIN}
          WHERE payment_mode = ?
          AND bank_account_number = ?
          ORDER BY updated_at DESC, id DESC
        `;

        params = [payment_mode, account_number];
      }

      let data = await queryDatabase(sql, params);

      // Normalize mysql2 response
      if (Array.isArray(data) && Array.isArray(data[0])) {
          data = data[0];
      }

      return res.status(200).json({
          success: true,
          data,
      });
    }

    // USDT / BTC / ERC20 / TRC20 - Return active record
    sql = `
      SELECT *
      FROM ${TABLES.PAYMENT_METHOD_ADMIN}
      WHERE payment_mode = ?
      AND (deposit_status = 'active' OR withdrawal_status = 'active')
      LIMIT 1
    `;

    params = [payment_mode];

    const data = await queryDatabase(sql, params);

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: data[0],
    });

  } catch (error) {
    console.error("Error in getAdminPaymentByParams:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = { uploadToCloudinary, paymentUpload, paymentMode, getAllpaymentMode, getPaymentModeById, getPaymentByParams, getActivePaymentModes,toggleIsUsed, deletePaymentMode, updatePaymentMode, getAdminPaymentByParams };

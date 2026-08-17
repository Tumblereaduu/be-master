const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const multer = require('multer');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
const { error } = require("console");

// Multer configuration for multiple files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
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
        folder: `kyc/ib/${sanitizedFolder}`,
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


// IB Profile Page Submit KYC Photos

const submitIBKYC = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: "error", message: "Unauthorized user id or token" });
    }

    const user_id = req.user.id;

    // Check if this user already submitted IB-KYC
    const [rows] = await queryDatabase(
      `SELECT id FROM ${TABLES.ADMIN_BONUS} WHERE user_id = ? LIMIT 1`,
      [user_id]
    );

    const exists = rows.length > 0;

    // const hasAnyFile = req.files && Object.keys(req.files).length > 0;


    const uploadIfExists = async (key) => req.files?.[key]?.[0] ? await uploadToCloudinary(req.files[key][0].buffer, `IB_KYC_${user_id}`, key) : null;

    const files = [
      await uploadIfExists("ib_kyc_id_1"),
      await uploadIfExists("ib_kyc_id_2"),
      await uploadIfExists("ib_kyc_id_3"),
      await uploadIfExists("ib_kyc_id_4"),
      await uploadIfExists("ib_kyc_id_5"),
      await uploadIfExists("ib_kyc_id_6"),
    ];

    // Require all docs ONLY on first submission
    // if (!exists && hasAnyFile) {
    //   return res.status(400).json({
    //     status: "error",
    //     message: "All 6 documents are required on first submission"
    //   });
    // }

    // Require all docs ONLY on first submission
    const requiredKeys = [ "ib_kyc_id_1", "ib_kyc_id_2", "ib_kyc_id_3", "ib_kyc_id_4", "ib_kyc_id_5", "ib_kyc_id_6"];
    const hasAllFiles = req.files && requiredKeys.every( (key) => req.files[key] && req.files[key].length > 0);

   // Require all docs ONLY on first submission
   if (!exists && !hasAllFiles) {
     return res.status(400).json({
     status: "error",
     message: "All 6 documents are required on first submission"
    });
  }

    const photoStatuses = files.map(f => f ? 'pending' : null);

    if (!exists) {
      // First submission
      await queryDatabase(
        `INSERT INTO ${TABLES.ADMIN_BONUS}
         (user_id, ib_kyc_id_1, ib_kyc_id_2, ib_kyc_id_3, ib_kyc_id_4, ib_kyc_id_5, ib_kyc_id_6, ib_photo_id_1_status, ib_photo_id_2_status, ib_photo_id_3_status,
          ib_photo_id_4_status, ib_photo_id_5_status, ib_photo_id_6_status, ib_kyc_status, ib_documents_uploaded_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [user_id, ...files, ...photoStatuses]
      );
    } else {
      // Update submission: only re-uploaded files
      const updates = [];
      const params = [];
      const fileColumns = ["ib_kyc_id_1", "ib_kyc_id_2", "ib_kyc_id_3", "ib_kyc_id_4", "ib_kyc_id_5", "ib_kyc_id_6"];
      const statusColumns = ["ib_photo_id_1_status", "ib_photo_id_2_status", "ib_photo_id_3_status", "ib_photo_id_4_status", "ib_photo_id_5_status", "ib_photo_id_6_status"];

      for (let i = 0; i < 6; i++) {
        if (files[i]) {
          updates.push(`${fileColumns[i]} = ?`);
          params.push(files[i]);

          // Set status to pending only if a file exists
          updates.push(`${statusColumns[i]} = 'pending'`);
        }
      }


      if (updates.length) {
        await queryDatabase(
          `UPDATE ${TABLES.ADMIN_BONUS}
           SET ${updates.join(", ")},
               ib_kyc_status = 'pending',
               ib_documents_uploaded_at = NOW(),
               ib_documents_verified_at = NULL
           WHERE user_id = ?`,
          [...params, user_id]
        );
      }
    }

    return res.status(200).json({
      status: "success",
      message: "IB-KYC submitted successfully"
    });

  } catch (error) {
    console.error("IB-KYC Error", error);
    return res.status(500).json({
      status: "error",
      message: "IB-KYC server error",
      error: error.message
    });
  }
};

// IB KYC Show

const getIBKYC = async (req, res) => {

  const userId = req.user.id;
  try {
    const [rows] = await queryDatabase(`SELECT ib_kyc_status FROM ${TABLES.ADMIN_BONUS} WHERE user_id = ? LIMIT 1`, [userId]);

    const status = rows?.[0]?.ib_kyc_status || "Not submitted";

    return res.status(200).json({ status: "success", message: "Fetched successfully", status });

  } catch (error) {
    console.error("getIBKYC Error", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch IB KYC status",
      error: error.message,
    });
  }
}

// IB user to show kyc details

const getIBKYCStatus = async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await queryDatabase(`
      SELECT 
        b.ib_kyc_id_1, b.ib_kyc_id_2, b.ib_kyc_id_3, b.ib_kyc_id_4, b.ib_kyc_id_5, b.ib_kyc_id_6, b.ib_photo_id_1_status, b.ib_photo_id_2_status, b.ib_photo_id_3_status,
        b.ib_photo_id_4_status, b.ib_photo_id_5_status, b.ib_photo_id_6_status, b.ib_kyc_status, b.created_at, c.ib_status
      FROM ${TABLES.ADMIN_BONUS} b JOIN ${TABLES.REGISTER} c ON c.id = user_id
      WHERE user_id = ?
    `, [user_id]);

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result[0]); // send the row directly
  } catch (error) {
    console.error("Error fetching KYC:", error);
    res.status(500).json({ status: "error", message: "getIBKYCStatus Server error" });
  }
};


// IB Admin page to Show all KYC Details 

const getIBAllKYC = async (req, res) => {
  try {
    const query = `
      SELECT  id, user_id, ib_photo_id_1_status, ib_photo_id_2_status, ib_photo_id_3_status, ib_photo_id_4_status ,ib_photo_id_5_status, ib_photo_id_6_status, 
      ib_kyc_status, ib_documents_verified_at , ib_documents_uploaded_at
      FROM ${TABLES.ADMIN_BONUS}
      ORDER BY ib_documents_uploaded_at DESC
    `;

    const users = await queryDatabase(query);

    res.json({
      status: "success",
      message: "Fetched all IB KYC details successfully",
      data: users,
    });

  } catch (error) {
    console.error(" Error fetching KYC users:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch KYC users",
      error: error.message,
    });
  }
};

// IB Admin single user KYC Shown

const userIBKYC = async (req, res) => {
  try {
    const { id: user_id } = req.params;

    const result = await queryDatabase(`
      SELECT ib_kyc_id_1, ib_kyc_id_2, ib_kyc_id_3, ib_kyc_id_4, ib_kyc_id_5, ib_kyc_id_6, 
        ib_photo_id_1_status AS ib_kyc_id_1_status, ib_photo_id_2_status AS ib_kyc_id_2_status , ib_photo_id_3_status AS ib_kyc_id_3_status,
        ib_photo_id_4_status AS ib_kyc_id_4_status,
        ib_photo_id_5_status AS ib_kyc_id_5_status,
        ib_photo_id_6_status AS ib_kyc_id_6_status,
        ib_kyc_status, created_at
      FROM ${TABLES.ADMIN_BONUS}
      WHERE user_id = ?
    `, [user_id]);

    if (!result.length) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      message: "User IB KYC fetched successfully",
      data: result[0],
    });

  } catch (error) {
    console.error("Error fetching single user KYC:", error);
    res.status(500).json({
      status: "error",
      message: "Error while fetching IB KYC, Server error",
    });
  }
};

// IB Admin Approve and Reject status

const updateIBKYCStatus = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { photokey, status, reason } = req.body;

    if (!user_id || !photokey || !status) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    // Convert ib_kyc_id_1 → ib_photo_id_1
    const photoKey = photokey.replace("ib_kyc", "ib_photo");
    const statusField = `${photoKey}_status`;
    const reasonField = `${photoKey}_reason`;
    const fileField = photokey; // This is the actual file column

    // Only remove the file if rejected
    const fileValue = status.toLowerCase() === "rejected" ? null : undefined;

    // Update status, reason, and optionally file
    let query = `
      UPDATE ${TABLES.ADMIN_BONUS}
      SET ${statusField} = ?, ${reasonField} = ?
    `;

    const params = [status, reason || null];

    if (fileValue === null) {
      query += `, ${fileField} = ?`;
      params.push(fileValue);
    }

    query += ` WHERE user_id = ?`;
    params.push(user_id);

    await queryDatabase(query, params);

    // Recalculate overall KYC status
    await queryDatabase(
      `
      UPDATE ${TABLES.ADMIN_BONUS}
      SET 
        ib_kyc_status =
          CASE
            WHEN ib_photo_id_1_status='approved'
             AND ib_photo_id_2_status='approved'
             AND ib_photo_id_3_status='approved'
             AND ib_photo_id_4_status='approved'
             AND ib_photo_id_5_status='approved'
             AND ib_photo_id_6_status='approved'
            THEN 'completed'

            WHEN ib_photo_id_1_status='rejected'
              OR ib_photo_id_2_status='rejected'
              OR ib_photo_id_3_status='rejected'
              OR ib_photo_id_4_status='rejected'
              OR ib_photo_id_5_status='rejected'
              OR ib_photo_id_6_status='rejected'
            THEN 'rejected'

            ELSE 'pending'
          END,

        ib_documents_verified_at =
          CASE
            WHEN ib_photo_id_1_status='approved'
             AND ib_photo_id_2_status='approved'
             AND ib_photo_id_3_status='approved'
             AND ib_photo_id_4_status='approved'
             AND ib_photo_id_5_status='approved'
             AND ib_photo_id_6_status='approved'
            THEN NOW()
            ELSE NULL
          END
      WHERE user_id = ?`,
      [user_id]
    );

    // Fetch updated status and files
    const [updated] = await queryDatabase(
      `SELECT ib_kyc_status, ib_documents_verified_at, ib_kyc_id_1, ib_kyc_id_2, ib_kyc_id_3, ib_kyc_id_4, ib_kyc_id_5, ib_kyc_id_6
       FROM ${TABLES.ADMIN_BONUS}
       WHERE user_id = ?`,
      [user_id]
    );

    if (!updated || !updated[0]) {
      return res.status(404).json({
        status: "error",
        message: "IB bonus record not found for this user"
      });
    }

    res.json({
      status: "success",
      message: `KYC ${photokey} marked as ${status}`,
      overallStatus: updated[0].ib_kyc_status,
      verifiedAt: updated[0].ib_documents_verified_at,
      files: {
        ib_kyc_id_1: updated[0].ib_kyc_id_1,
        ib_kyc_id_2: updated[0].ib_kyc_id_2,
        ib_kyc_id_3: updated[0].ib_kyc_id_3,
        ib_kyc_id_4: updated[0].ib_kyc_id_4,
        ib_kyc_id_5: updated[0].ib_kyc_id_5,
        ib_kyc_id_6: updated[0].ib_kyc_id_6,
      }
    });

  } catch (err) {
    console.error("Error updating KYC status:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { submitIBKYC, getIBKYC, getIBKYCStatus, getIBAllKYC, userIBKYC, updateIBKYCStatus }

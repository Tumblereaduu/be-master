// const { queryDatabase } = require("../../config/db");
// const { TABLES } = require("../../config/tables");
// const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
// const multer = require('multer');
// const path = require('path');
// const cloudinary = require('../../config/cloudinary');
// // const { sendKycEmail } = require("../../utils/email");

// // Multer configuration for multiple files
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit per file
//   },
//   fileFilter: (req, file, cb) => {
//     const filetypes = /jpeg|jpg|png|pdf/;
//     const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = filetypes.test(file.mimetype);
//     if (extname && mimetype) {
//       return cb(null, true);
//     }
//     cb(new Error('Only images and PDFs are allowed!'));
//   }
// });

// // Cloudinary upload with sanitized folder name
// const uploadToCloudinary = (fileBuffer, folder, filename) => {
//   return new Promise((resolve, reject) => {
//     let attempts = 0;
//     const maxAttempts = 3;
//     const initialTimeout = 120000; // 120 seconds

//     const attemptUpload = () => {
//       attempts++;
//       console.log(`Attempt ${attempts} for ${filename}`);

//       // Sanitize folder name: trim whitespace and replace invalid characters
//       const sanitizedFolder = folder.trim().replace(/[^a-zA-Z0-9-_]/g, '_');

//       const uploadOptions = {
//         folder: `kyc/${sanitizedFolder}`,
//         resource_type: 'auto',
//         timeout: initialTimeout + (attempts * 30000),
//         public_id: `${filename}_${Date.now()}`,
//         overwrite: false
//       };

//       const uploadStream = cloudinary.uploader.upload_stream(
//         uploadOptions,
//         (error, result) => {
//           if (error) {
//             console.error(`Upload attempt ${attempts} failed:`, error.message);
//             if (attempts < maxAttempts && (error.message.includes('timeout') || error.http_code === 499)) {
//               setTimeout(attemptUpload, 3000 * attempts); // Progressive delay
//             } else {
//               reject(new Error(`Cloudinary upload failed after ${attempts} attempts: ${error.message}`));
//             }
//           } else {
//             console.log(`Upload successful on attempt ${attempts}`);
//             resolve(result.secure_url);
//           }
//         }
//       );

//       uploadStream.on('error', (streamError) => {
//         console.error(`Stream error on attempt ${attempts}:`, streamError.message);
//         if (attempts < maxAttempts) {
//           setTimeout(attemptUpload, 3000 * attempts);
//         } else {
//           reject(streamError);
//         }
//       });

//       const timeoutId = setTimeout(() => {
//         uploadStream.destroy(new Error('Custom timeout exceeded'));
//       }, uploadOptions.timeout);

//       uploadStream.on('finish', () => clearTimeout(timeoutId));
//       uploadStream.end(fileBuffer);
//     };

//     attemptUpload();
//   });
// };

// // Multer middleware for KYC document uploads
// const kycDocumentUpload = upload.fields([
//   { name: 'photo_id_1', maxCount: 1 },
//   { name: 'photo_id_2', maxCount: 1 },
//   { name: 'photo_id_3', maxCount: 1 }
// ]);

// // Multer middleware for single photo upload
// const singlePhotoUpload = upload.single('photo');

// const submitKYCDetails = async (req, res) => {
//   try {
//     const { user_id, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type } = req.body;
//     if (!user_id) {
//       return res.status(400).json({ status: 'error', message: 'User ID required' });
//     }

//     // Fetch existing user (if any)
//     const [existingUser] = await queryDatabase(
//       `SELECT * FROM ${TABLES.REGISTER} WHERE id = ?`, 
//       [user_id]
//     );

//     // Upload images to Cloudinary if provided
//     const photo_id_1_url = req.files?.photo_id_1?.[0] 
//       ? await uploadToCloudinary(req.files.photo_id_1[0].buffer, user_id, req.files.photo_id_1[0].originalname)
//       : null;
//     const photo_id_2_url = req.files?.photo_id_2?.[0] 
//       ? await uploadToCloudinary(req.files.photo_id_2[0].buffer, user_id, req.files.photo_id_2[0].originalname)
//       : null;
//     const photo_id_3_url = req.files?.photo_id_3?.[0] 
//       ? await uploadToCloudinary(req.files.photo_id_3[0].buffer, user_id, req.files.photo_id_3[0].originalname)
//       : null;

//     // Backend validation: Require at least one image
//     const allImagesNull = !photo_id_1_url && !photo_id_2_url && !photo_id_3_url;
//     const userHasNoImages = !existingUser || 
//     (existingUser && !existingUser.photo_id_1 && !existingUser.photo_id_2 && !existingUser.photo_id_3);

//     if (allImagesNull && userHasNoImages) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'At least one KYC image is required'
//       });
//     }

//     if (!existingUser) {
//       // Insert new user record
//       await queryDatabase(`
//         INSERT INTO ${TABLES.REGISTER} 
//         (id, photo_id_1, photo_id_2, photo_id_3,
//          photo_id_1_status, photo_id_2_status, photo_id_3_status,
//          photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type,
//          photo_verification_status, photo_uploaded_at)
//         VALUES (?, ?, ?, ?, 'pending','pending','pending', ?, ?, ?, 'pending', NOW())
//       `, [user_id, photo_id_1_url, photo_id_2_url, photo_id_3_url, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type]);
//     } else {
//       // Update existing user record
//       await queryDatabase(`
//         UPDATE ${TABLES.REGISTER}
//         SET photo_id_1 = COALESCE(?, photo_id_1),
//             photo_id_2 = COALESCE(?, photo_id_2),
//             photo_id_3 = COALESCE(?, photo_id_3),
//             photo_id_1_document_type = COALESCE(?, photo_id_1_document_type),
//             photo_id_2_document_type = COALESCE(?, photo_id_2_document_type),
//             photo_id_3_document_type = COALESCE(?, photo_id_3_document_type),
//             photo_id_1_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_1_status END,
//             photo_id_2_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_2_status END,
//             photo_id_3_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_3_status END,
//             photo_verification_status = 'pending',
//             photo_uploaded_at = NOW()
//         WHERE id = ?
//       `, [photo_id_1_url, photo_id_2_url, photo_id_3_url, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type, photo_id_1_url, photo_id_2_url, photo_id_3_url, user_id]);
//     }

//     res.json({ status: 'success', message: 'KYC images saved successfully.' });

//   } catch (err) {
//     console.error('KYC image upload error:', err);
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };


// // const submitKYCDetails = async (req, res) => {
// //   try {
// //     const { user_id } = req.body;
// //     if (!user_id) {
// //       return res.status(400).json({ status: 'error', message: 'User ID required' });
// //     }

// //     // Fetch existing user
// //     const [existingUser] = await queryDatabase(
// //       `SELECT * FROM ${TABLES.REGISTER} WHERE id = ?`,
// //       [user_id]
// //     );

// //     // Define KYC fields dynamically
// //     const kycFields = [
// //       { field: 'photo_id_1', label: 'Front ID' },
// //       { field: 'photo_id_2', label: 'Back ID' },
// //       { field: 'photo_id_3', label: 'Bank Statement' },
// //     ];

// //     const uploadedUrls = {};
// //     const missingImages = [];

// //     // Loop through each KYC field
// //     for (let kyc of kycFields) {
// //       const file = req.files?.[kyc.field]?.[0];
// //       const existingStatus = existingUser?.[`${kyc.field}_status`]?.toLowerCase();

// //       // Upload if new file provided
// //       uploadedUrls[kyc.field] = file
// //         ? await uploadToCloudinary(file.buffer, user_id, file.originalname)
// //         : null;

// //       // Determine if this image is required
// //       if (!existingUser) {
// //         // First submission → all images required
// //         if (!uploadedUrls[kyc.field]) missingImages.push(kyc.label);
// //       } else {
// //         // Subsequent submission → only rejected images required
// //         if ((!existingUser[kyc.field] || existingStatus === 'rejected') && !uploadedUrls[kyc.field]) {
// //           missingImages.push(kyc.label);
// //         }
// //       }
// //     }

// //     if (missingImages.length > 0) {
// //       return res.status(400).json({
// //         status: 'error',
// //         message: `Please upload required images: ${missingImages.join(', ')}`
// //       });
// //     }

// //     if (!existingUser) {
// //       // Insert new record
// //       await queryDatabase(`
// //         INSERT INTO ${TABLES.REGISTER} 
// //         (id, photo_id_1, photo_id_2, photo_id_3,
// //          photo_id_1_status, photo_id_2_status, photo_id_3_status,
// //          photo_verification_status, photo_uploaded_at)
// //         VALUES (?, ?, ?, ?, 'pending','pending','pending','pending', NOW())
// //       `, [user_id, uploadedUrls.photo_id_1, uploadedUrls.photo_id_2, uploadedUrls.photo_id_3]);
// //     } else {
// //       // Update existing record
// //       await queryDatabase(`
// //         UPDATE ${TABLES.REGISTER}
// //         SET photo_id_1 = COALESCE(?, photo_id_1),
// //             photo_id_2 = COALESCE(?, photo_id_2),
// //             photo_id_3 = COALESCE(?, photo_id_3),
// //             photo_id_1_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_1_status END,
// //             photo_id_2_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_2_status END,
// //             photo_id_3_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_3_status END,
// //             photo_verification_status = 'pending',
// //             photo_uploaded_at = NOW()
// //         WHERE id = ?
// //       `, [
// //         uploadedUrls.photo_id_1,
// //         uploadedUrls.photo_id_2,
// //         uploadedUrls.photo_id_3,
// //         uploadedUrls.photo_id_1,
// //         uploadedUrls.photo_id_2,
// //         uploadedUrls.photo_id_3,
// //         user_id
// //       ]);
// //     }

// //     res.json({ status: 'success', message: 'KYC images uploaded successfully.' });

// //   } catch (err) {
// //     console.error('KYC image upload error:', err);
// //     res.status(500).json({ status: 'error', message: err.message });
// //   }
// // };









// // Save only Popup fields (employment, occupation, income, etc.)
// const savePopupData = async (req, res) => {
//   try {
//     const { user_id, employment_status, occupation, trading_experience, income_range, source_of_income } = req.body;
//     if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID required' });

//     const [existingUser] = await queryDatabase(`SELECT id FROM ${TABLES.REGISTER} WHERE id = ?`, [user_id]);

//     if (existingUser) {
//       await queryDatabase(`
//         UPDATE ${TABLES.REGISTER}
//         SET employment_status=?, occupation=?, trading_experience=?, income_range=?, source_of_income=?
//         WHERE id=?
//       `, [employment_status, occupation, trading_experience, income_range, source_of_income, user_id]);
//     } else {
//       await queryDatabase(`
//         INSERT INTO ${TABLES.REGISTER} (id, employment_status, occupation, trading_experience, income_range, source_of_income)
//         VALUES (?, ?, ?, ?, ?, ?)
//       `, [user_id, employment_status, occupation, trading_experience, income_range, source_of_income]);
//     }

//     res.json({ status: 'success', message: 'Popup data saved successfully.' });
//   } catch (err) {
//     console.error('Popup data error:', err);
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };


// //  Get all KYC users (admin view)
// const getAllKYC = async (req, res) => {
//   try {
//     const query = `
//       SELECT 
//         id,
//         username,
//         email,
//         photo_id_1,
//         photo_id_2,
//         photo_id_3,
//         photo_uploaded_at,
//         photo_verification_timestamp,
//         photo_id_1_status,
//         photo_id_2_status,
//         photo_id_3_status
//       FROM ${TABLES.REGISTER}
//       ORDER BY photo_uploaded_at DESC
//     `;

//     const users = await queryDatabase(query);

//     res.json({
//       status: "success",
//       data: users,
//     });

//   } catch (error) {
//     console.error(" Error fetching KYC users:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to fetch KYC users",
//       error: error.message,
//     });
//   }
// };

// // Get KYC data from single user

// const userKYC = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const result = await queryDatabase(`
//       SELECT  
//         id,
//         username,
//         email,
//         photo_id_1,
//         photo_id_2,
//         photo_id_3,
//         photo_verification_status,
//         photo_uploaded_at,
//         photo_id_1_status,
//         photo_id_2_status,
//         photo_id_3_status,
//         photo_id_1_document_type,
//         photo_id_2_document_type,
//         photo_id_3_document_type,
//         employment_status,
//         occupation,
//         trading_experience,
//         income_range,
//         source_of_income
//       FROM ${TABLES.REGISTER}
//       WHERE id = ?
//     `, [id]);

//     if (!result.length) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found",
//       });
//     }

//     res.json({
//       status: "success",
//       data: result[0],
//     });

//   } catch (error) {
//     console.error("❌ Error fetching single user KYC:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Server error",
//     });
//   }
// };

// //  Backend - getKYCStatus
// const getKYCStatus = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const result = await queryDatabase(`
//       SELECT 
//         id,
//         photo_id_1_status,
//         photo_id_2_status,
//         photo_id_3_status,
//         ib_status,
//         photo_id_1_document_type,
//         photo_id_3_document_type
//       FROM ${TABLES.REGISTER}
//       WHERE id = ?
//     `, [id]);

//     if (!result.length) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json(result[0]); // ✅ send the row directly
//   } catch (err) {
//     console.error("Error fetching KYC:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };


// const updateKYCStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { photokey, status, reason } = req.body;

//     if (!id || !photokey || !status) {
//       return res.status(400).json({ status: "error", message: "Missing required fields." });
//     }

//     const statusField = `${photokey}_status`;
//     const reasonField = `${photokey}_reason`;

//     // Fetch current overall KYC status before updating
//     const currentRows = await queryDatabase(
//       `SELECT photo_verification_status, email, username FROM ${TABLES.REGISTER} WHERE id = ?`,
//       [id]
//     );
//     const currentUser = Array.isArray(currentRows[0]) ? currentRows[0][0] : currentRows[0];

//     if (!currentUser) {
//       return res.status(404).json({ status: "error", message: "User not found." });
//     }

//     const previousStatus = currentUser.photo_verification_status;

//     // If rejected → remove the image from DB
//     if (status.toLowerCase() === "rejected") {
//       await queryDatabase(
//         `UPDATE ${TABLES.REGISTER} SET ${photokey} = NULL WHERE id = ?`,
//         [id]
//       );
//     }

//     // Update status and reason in DB
//     await queryDatabase(
//       `
//       UPDATE ${TABLES.REGISTER}
//       SET 
//         ${statusField} = ?,
//         ${reasonField} = ?,
//         photo_verification_status = (
//           CASE
//             WHEN photo_id_1_status = 'approved'
//               AND photo_id_2_status = 'approved'
//               AND photo_id_3_status = 'approved' THEN 'approved'
//             WHEN photo_id_1_status = 'rejected'
//               OR photo_id_2_status = 'rejected'
//               OR photo_id_3_status = 'rejected' THEN 'rejected'
//             ELSE 'pending'
//           END
//         ),
//         photo_verification_timestamp = NOW()
//       WHERE id = ?
//       `,
//     [status, reason, id]);

//     // Fetch updated status
//     const updatedRows = await queryDatabase(
//       `SELECT photo_verification_status, email, username FROM ${TABLES.REGISTER} WHERE id = ?`,
//       [id]
//     );
//     const updatedUser = Array.isArray(updatedRows[0]) ? updatedRows[0][0] : updatedRows[0];
//     const updatedStatus = updatedUser.photo_verification_status;

//     // Send email only if the status changed to approved or if a photo is rejected
//     // if (updatedStatus === "approved" && previousStatus !== "approved") {
//     //   // Send KYC approved email only once
//     //   await sendKycEmail({
//     //     toEmail: updatedUser.email,
//     //     username: updatedUser.username,
//     //     status: "approved",
//     //     reason: null
//     //   });
//     // } else if (status.toLowerCase() === "rejected") {
//     //   // Send rejection email immediately
//     //   const formattedReasons = { [photokey]: reason };
//     //   await sendKycEmail({
//     //     toEmail: updatedUser.email,
//     //     username: updatedUser.username,
//     //     status: "rejected",
//     //     reason: formattedReasons
//     //   });
//     // }

//     res.json({
//       status: "success",
//       message: `KYC ${photokey} marked as ${status}`,
//       overallStatus: updatedStatus
//     });
//   } catch (err) {
//     console.error("Error updating KYC status:", err);
//     res.status(500).json({ status: "error", message: err.message });
//   }
// };

// // Admin KYC

// const submitAdminKyc = async (req,res)=>{
//   try {
//     const {user_id} = req.body;

//     if(!user_id){
//       return res.status(400).json({status:"error",message:"User Id not required"})
//     }
//        // check user is in table
//        const users = await queryDatabase (`SELECT id FROM ${TABLES.REGISTER} WHERE id = ? `, [user_id] ) ; 

//        if(!users.length){
//         return res.status(400).json({status:"error",message:"User not found"})
//        }

//        // All 3 Files are required

//        if(!req.files?.photo_id_1 || !req.files?.photo_id_2 || !req.files?.photo_id_3 ){
//         return res.status(400).json({status:"error",message:"Upload all 3 documents"})
//        }

//        // upload files to cloudinary

//        const photo_id_1_url = await uploadToCloudinary(req.files.photo_id_1[0].buffer,user_id,"front_id");
//        const photo_id_2_url = await uploadToCloudinary(req.files.photo_id_2[0].buffer,user_id,"back_id");
//        const photo_id_3_url = await uploadToCloudinary(req.files.photo_id_3[0].buffer,user_id,"bank_proof");

//          const result = await queryDatabase(`UPDATE ${TABLES.REGISTER} SET photo_id_1 = ?, photo_id_2 = ?, photo_id_3 = ?,
//          photo_id_1_status = 'approved',photo_id_2_status = 'approved',photo_id_3_status = 'approved',
//          photo_verification_status = 'approved', photo_uploaded_at = NOW(), photo_verification_timestamp = NOW() WHERE id = ? ` , 
//          [photo_id_1_url,photo_id_2_url,photo_id_3_url,user_id])

//          if(result.affectedRows === 0) {
//           return res.status(400).json({status:"error",message:"KYC not saved "})
//          }

//          return res.status(200).json({
//           status:"success",
//           message:"Admin KYC Completed"
//          });

//   } catch (error) {
//     console.error("Admin KYC Error",error);
//     return res.status(500).json({status:"error",message:"Admin KYC Internal issues"})
//   }
// };


// module.exports = {
//   singlePhotoUpload,
//   kycDocumentUpload,
//   submitKYCDetails,
//   savePopupData,
//   getAllKYC,
//   userKYC,
//   getKYCStatus,
//   updateKYCStatus,
//   submitAdminKyc
// };


const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
const multer = require('multer');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
// const { sendKycEmail } = require("../../utils/email");

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
        folder: `kyc/${sanitizedFolder}`,
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

// Multer middleware for KYC document uploads
const kycDocumentUpload = upload.fields([
  { name: 'photo_id_1', maxCount: 1 },
  { name: 'photo_id_2', maxCount: 1 },
  { name: 'photo_id_3', maxCount: 1 }
]);

// Multer middleware for single photo upload
const singlePhotoUpload = upload.single('photo');

const submitKYCDetails = async (req, res) => {
  try {
    const { user_id, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type } = req.body;
    if (!user_id) {
      return res.status(400).json({ status: 'error', message: 'User ID required' });
    }

    // Fetch existing user (if any)
    const [existingUser] = await queryDatabase(
      `SELECT * FROM ${TABLES.REGISTER} WHERE id = ?`, 
      [user_id]
    );

    // Upload images to Cloudinary if provided
    const photo_id_1_url = req.files?.photo_id_1?.[0] 
      ? await uploadToCloudinary(req.files.photo_id_1[0].buffer, user_id, req.files.photo_id_1[0].originalname)
      : null;
    const photo_id_2_url = req.files?.photo_id_2?.[0] 
      ? await uploadToCloudinary(req.files.photo_id_2[0].buffer, user_id, req.files.photo_id_2[0].originalname)
      : null;
    const photo_id_3_url = req.files?.photo_id_3?.[0] 
      ? await uploadToCloudinary(req.files.photo_id_3[0].buffer, user_id, req.files.photo_id_3[0].originalname)
      : null;

    // Backend validation: Require at least one image
    const allImagesNull = !photo_id_1_url && !photo_id_2_url && !photo_id_3_url;
    const userHasNoImages = !existingUser || 
    (existingUser && !existingUser.photo_id_1 && !existingUser.photo_id_2 && !existingUser.photo_id_3);

    if (allImagesNull && userHasNoImages) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one KYC image is required'
      });
    }

    if (!existingUser) {
      // Insert new user record
      await queryDatabase(`
        INSERT INTO ${TABLES.REGISTER} 
        (id, photo_id_1, photo_id_2, photo_id_3,
         photo_id_1_status, photo_id_2_status, photo_id_3_status,
         photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type,
         photo_verification_status, photo_uploaded_at)
        VALUES (?, ?, ?, ?, 'pending','pending','pending', ?, ?, ?, 'pending', NOW())
      `, [user_id, photo_id_1_url, photo_id_2_url, photo_id_3_url, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type]);
    } else {
      // Update existing user record
      await queryDatabase(`
        UPDATE ${TABLES.REGISTER}
        SET photo_id_1 = COALESCE(?, photo_id_1),
            photo_id_2 = COALESCE(?, photo_id_2),
            photo_id_3 = COALESCE(?, photo_id_3),
            photo_id_1_document_type = COALESCE(?, photo_id_1_document_type),
            photo_id_2_document_type = COALESCE(?, photo_id_2_document_type),
            photo_id_3_document_type = COALESCE(?, photo_id_3_document_type),
            photo_id_1_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_1_status END,
            photo_id_2_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_2_status END,
            photo_id_3_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_3_status END,
            photo_verification_status = 'pending',
            photo_uploaded_at = NOW()
        WHERE id = ?
      `, [photo_id_1_url, photo_id_2_url, photo_id_3_url, photo_id_1_document_type, photo_id_2_document_type, photo_id_3_document_type, photo_id_1_url, photo_id_2_url, photo_id_3_url, user_id]);
    }

    res.json({ status: 'success', message: 'KYC images saved successfully.' });

  } catch (err) {
    console.error('KYC image upload error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};


// const submitKYCDetails = async (req, res) => {
//   try {
//     const { user_id } = req.body;
//     if (!user_id) {
//       return res.status(400).json({ status: 'error', message: 'User ID required' });
//     }

//     // Fetch existing user
//     const [existingUser] = await queryDatabase(
//       `SELECT * FROM ${TABLES.REGISTER} WHERE id = ?`,
//       [user_id]
//     );

//     // Define KYC fields dynamically
//     const kycFields = [
//       { field: 'photo_id_1', label: 'Front ID' },
//       { field: 'photo_id_2', label: 'Back ID' },
//       { field: 'photo_id_3', label: 'Bank Statement' },
//     ];

//     const uploadedUrls = {};
//     const missingImages = [];

//     // Loop through each KYC field
//     for (let kyc of kycFields) {
//       const file = req.files?.[kyc.field]?.[0];
//       const existingStatus = existingUser?.[`${kyc.field}_status`]?.toLowerCase();

//       // Upload if new file provided
//       uploadedUrls[kyc.field] = file
//         ? await uploadToCloudinary(file.buffer, user_id, file.originalname)
//         : null;

//       // Determine if this image is required
//       if (!existingUser) {
//         // First submission → all images required
//         if (!uploadedUrls[kyc.field]) missingImages.push(kyc.label);
//       } else {
//         // Subsequent submission → only rejected images required
//         if ((!existingUser[kyc.field] || existingStatus === 'rejected') && !uploadedUrls[kyc.field]) {
//           missingImages.push(kyc.label);
//         }
//       }
//     }

//     if (missingImages.length > 0) {
//       return res.status(400).json({
//         status: 'error',
//         message: `Please upload required images: ${missingImages.join(', ')}`
//       });
//     }

//     if (!existingUser) {
//       // Insert new record
//       await queryDatabase(`
//         INSERT INTO ${TABLES.REGISTER} 
//         (id, photo_id_1, photo_id_2, photo_id_3,
//          photo_id_1_status, photo_id_2_status, photo_id_3_status,
//          photo_verification_status, photo_uploaded_at)
//         VALUES (?, ?, ?, ?, 'pending','pending','pending','pending', NOW())
//       `, [user_id, uploadedUrls.photo_id_1, uploadedUrls.photo_id_2, uploadedUrls.photo_id_3]);
//     } else {
//       // Update existing record
//       await queryDatabase(`
//         UPDATE ${TABLES.REGISTER}
//         SET photo_id_1 = COALESCE(?, photo_id_1),
//             photo_id_2 = COALESCE(?, photo_id_2),
//             photo_id_3 = COALESCE(?, photo_id_3),
//             photo_id_1_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_1_status END,
//             photo_id_2_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_2_status END,
//             photo_id_3_status = CASE WHEN ? IS NOT NULL THEN 'pending' ELSE photo_id_3_status END,
//             photo_verification_status = 'pending',
//             photo_uploaded_at = NOW()
//         WHERE id = ?
//       `, [
//         uploadedUrls.photo_id_1,
//         uploadedUrls.photo_id_2,
//         uploadedUrls.photo_id_3,
//         uploadedUrls.photo_id_1,
//         uploadedUrls.photo_id_2,
//         uploadedUrls.photo_id_3,
//         user_id
//       ]);
//     }

//     res.json({ status: 'success', message: 'KYC images uploaded successfully.' });

//   } catch (err) {
//     console.error('KYC image upload error:', err);
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };









// Save only Popup fields (employment, occupation, income, etc.)
const savePopupData = async (req, res) => {
  try {
    const { user_id, employment_status, occupation, trading_experience, income_range, source_of_income } = req.body;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID required' });

    const [existingUser] = await queryDatabase(`SELECT id FROM ${TABLES.REGISTER} WHERE id = ?`, [user_id]);

    if (existingUser) {
      await queryDatabase(`
        UPDATE ${TABLES.REGISTER}
        SET employment_status=?, occupation=?, trading_experience=?, income_range=?, source_of_income=?
        WHERE id=?
      `, [employment_status, occupation, trading_experience, income_range, source_of_income, user_id]);
    } else {
      await queryDatabase(`
        INSERT INTO ${TABLES.REGISTER} (id, employment_status, occupation, trading_experience, income_range, source_of_income)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [user_id, employment_status, occupation, trading_experience, income_range, source_of_income]);
    }

    res.json({ status: 'success', message: 'Popup data saved successfully.' });
  } catch (err) {
    console.error('Popup data error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};


//  Get all KYC users (admin view)
const getAllKYC = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        username,
        email,
        photo_id_1,
        photo_id_2,
        photo_id_3,
        photo_uploaded_at,
        photo_verification_timestamp,
        photo_id_1_status,
        photo_id_2_status,
        photo_id_3_status,
        photo_verified_by_admin_id,
        photo_verified_by_admin_name
      FROM ${TABLES.REGISTER}
      ORDER BY photo_uploaded_at DESC
    `;

    const users = await queryDatabase(query);

    res.json({
      status: "success",
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

// Get KYC data from single user

const userKYC = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryDatabase(`
      SELECT  
        id,
        username,
        email,
        photo_id_1,
        photo_id_2,
        photo_id_3,
        photo_verification_status,
        photo_uploaded_at,
        photo_id_1_status,
        photo_id_2_status,
        photo_id_3_status,
        photo_id_1_document_type,
        photo_id_2_document_type,
        photo_id_3_document_type,
        photo_verified_by_admin_id,
        photo_verified_by_admin_name,
        employment_status,
        occupation,
        trading_experience,
        income_range,
        source_of_income
      FROM ${TABLES.REGISTER}
      WHERE id = ?
    `, [id]);

    if (!result.length) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      data: result[0],
    });

  } catch (error) {
    console.error("❌ Error fetching single user KYC:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

//  Backend - getKYCStatus
const getKYCStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryDatabase(`
      SELECT 
        id,
        photo_id_1_status,
        photo_id_2_status,
        photo_id_3_status,
        ib_status,
        photo_id_1_document_type,
        photo_id_3_document_type
      FROM ${TABLES.REGISTER}
      WHERE id = ?
    `, [id]);

    if (!result.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result[0]); // ✅ send the row directly
  } catch (err) {
    console.error("Error fetching KYC:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const updateKYCStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { photokey, status, reason, photo_verified_by_admin_id, photo_verified_by_admin_name } = req.body;

    if (!id || !photokey || !status) {
      return res.status(400).json({ status: "error", message: "Missing required fields." });
    }

    const statusField = `${photokey}_status`;
    const reasonField = `${photokey}_reason`;

    // Fetch current overall KYC status before updating
    const currentRows = await queryDatabase(
      `SELECT photo_verification_status, email, username FROM ${TABLES.REGISTER} WHERE id = ?`,
      [id]
    );
    const currentUser = Array.isArray(currentRows[0]) ? currentRows[0][0] : currentRows[0];

    if (!currentUser) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    const previousStatus = currentUser.photo_verification_status;

    // If rejected → remove the image from DB
    if (status.toLowerCase() === "rejected") {
      await queryDatabase(
        `UPDATE ${TABLES.REGISTER} SET ${photokey} = NULL WHERE id = ?`,
        [id]
      );
    }

    // Update status and reason in DB
    await queryDatabase(
      `
      UPDATE ${TABLES.REGISTER}
      SET 
        ${statusField} = ?,
        ${reasonField} = ?,
        photo_verified_by_admin_id = ?,
        photo_verified_by_admin_name = ?,
        photo_verification_status = (
          CASE
            WHEN photo_id_1_status = 'approved'
              AND photo_id_2_status = 'approved'
              AND photo_id_3_status = 'approved' THEN 'approved'
            WHEN photo_id_1_status = 'rejected'
              OR photo_id_2_status = 'rejected'
              OR photo_id_3_status = 'rejected' THEN 'rejected'
            ELSE 'pending'
          END
        ),
        photo_verification_timestamp = NOW()
      WHERE id = ?
      `,
    [status, reason, photo_verified_by_admin_id || null, photo_verified_by_admin_name || null, id]);

    // Fetch updated status
    const updatedRows = await queryDatabase(
      `SELECT photo_verification_status, email, username FROM ${TABLES.REGISTER} WHERE id = ?`,
      [id]
    );
    const updatedUser = Array.isArray(updatedRows[0]) ? updatedRows[0][0] : updatedRows[0];
    const updatedStatus = updatedUser.photo_verification_status;

    // Send email only if the status changed to approved or if a photo is rejected
    // if (updatedStatus === "approved" && previousStatus !== "approved") {
    //   // Send KYC approved email only once
    //   await sendKycEmail({
    //     toEmail: updatedUser.email,
    //     username: updatedUser.username,
    //     status: "approved",
    //     reason: null
    //   });
    // } else if (status.toLowerCase() === "rejected") {
    //   // Send rejection email immediately
    //   const formattedReasons = { [photokey]: reason };
    //   await sendKycEmail({
    //     toEmail: updatedUser.email,
    //     username: updatedUser.username,
    //     status: "rejected",
    //     reason: formattedReasons
    //   });
    // }

    res.json({
      status: "success",
      message: `KYC ${photokey} marked as ${status}`,
      overallStatus: updatedStatus
    });
  } catch (err) {
    console.error("Error updating KYC status:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// Admin KYC

const submitAdminKyc = async (req,res)=>{
  try {
    const {user_id} = req.body;

    if(!user_id){
      return res.status(400).json({status:"error",message:"User Id not required"})
    }
       // check user is in table
       const users = await queryDatabase (`SELECT id FROM ${TABLES.REGISTER} WHERE id = ? `, [user_id] ) ; 

       if(!users.length){
        return res.status(400).json({status:"error",message:"User not found"})
       }

       // All 3 Files are required

       if(!req.files?.photo_id_1 || !req.files?.photo_id_2 || !req.files?.photo_id_3 ){
        return res.status(400).json({status:"error",message:"Upload all 3 documents"})
       }

       // upload files to cloudinary

       const photo_id_1_url = await uploadToCloudinary(req.files.photo_id_1[0].buffer,user_id,"front_id");
       const photo_id_2_url = await uploadToCloudinary(req.files.photo_id_2[0].buffer,user_id,"back_id");
       const photo_id_3_url = await uploadToCloudinary(req.files.photo_id_3[0].buffer,user_id,"bank_proof");

         const result = await queryDatabase(`UPDATE ${TABLES.REGISTER} SET photo_id_1 = ?, photo_id_2 = ?, photo_id_3 = ?,
         photo_id_1_status = 'approved',photo_id_2_status = 'approved',photo_id_3_status = 'approved',
         photo_verification_status = 'approved', photo_uploaded_at = NOW(), photo_verification_timestamp = NOW() WHERE id = ? ` , 
         [photo_id_1_url,photo_id_2_url,photo_id_3_url,user_id])

         if(result.affectedRows === 0) {
          return res.status(400).json({status:"error",message:"KYC not saved "})
         }

         return res.status(200).json({
          status:"success",
          message:"Admin KYC Completed"
         });

  } catch (error) {
    console.error("Admin KYC Error",error);
    return res.status(500).json({status:"error",message:"Admin KYC Internal issues"})
  }
};


module.exports = {
  singlePhotoUpload,
  kycDocumentUpload,
  submitKYCDetails,
  savePopupData,
  getAllKYC,
  userKYC,
  getKYCStatus,
  updateKYCStatus,
  submitAdminKyc
};

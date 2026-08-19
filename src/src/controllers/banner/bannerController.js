const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { SUCCESS_MESSAGES } = require("../../utils/errors");
const multer = require('multer');
const path = require('path');
const cloudinary = require('../../config/cloudinary');

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
                folder: `banner/${sanitizedFolder}`,
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

const createBanner = async (req, res) => {
    try {
        // FIX: Now extracting BOTH status AND location from req.body
        const { status = "active", location = "dashboard" } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image file is required!" });
        }

        const imageUrl = await uploadToCloudinary(req.file.buffer, 'banner', req.file.originalname);

        // FIX: Now inserting location column into database
        const sql = `INSERT INTO ${TABLES.ADMIN_BANNER} (image, status, location) VALUES(?, ?, ?)`;
        await queryDatabase(sql, [imageUrl, status, location]);

        res.json({
            success: true,
            message: "Banner upload successfully",
        })

    } catch (error) {
        console.error("Error while uploaing banner", error);
        res.status(500).json({
            status: false,
            message: "Error while uploading",
            error: error.message
        })

    }
}

const viewBanner = async (req, res) => {
    try {
        const sql = `SELECT * FROM ${TABLES.ADMIN_BANNER} ORDER BY created_at DESC`;
        const [rows] = await queryDatabase(sql, []);

        res.json({
            success: true,
            banners: rows,
        });

    } catch (error) {
        console.error("Error while fetching banners", error);
        res.status(500).json({
            success: false,
            message: "Error while fetching",
            error: error.message,
        })
    }
}

const toggleButton = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const sql = `UPDATE ${TABLES.ADMIN_BANNER} SET status = ? WHERE id =?`;
        await queryDatabase(sql, [status, id]);
        res.json({
            success: true,
            message: "Status updated"
        })

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Toggle error"
        })
    }
}

const deleteBanner = async (req,res)=>{
    try {
        const {id} = req.params

        const sql = `DELETE FROM ${TABLES.ADMIN_BANNER} WHERE id=?`;
        await queryDatabase(sql,[id]);

        res.json({
            success:true,
            message:"Banner deleted successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success:false,
            message:"Delete server error"
        })
    }
}


module.exports = { uploadToCloudinary, createBanner, viewBanner, toggleButton, deleteBanner }

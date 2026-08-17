const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
const multer = require("multer");
const path = require("path");
const cloudinary = require('../../config/cloudinary');

// Multer configuration 
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB LIMIT
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const extname = path.extname(file.originalname).toLowerCase();
            if (allowedExtensions.includes(extname)) {
                return cb(null, true);
            }
        }
        cb(new Error('Only image files (jpg, jpeg, png, webp, gif) are allowed!'));
    }
})

// cloudinary upload 
const uploadToCloudinary = (fileBuffer, folder, filename) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 3;
        const initialTimeout = 120000; // 120 seconds

        const attemptUpload = () => {
            attempts++;
            console.log(`Attempt ${attempts} for ${filename}`);

            const sanitizedFolder = folder.trim().replace(/[^a-zA-Z0-9-_]/g, '_');

            const uploadOptions = {
                folder: `support/${sanitizedFolder}`,
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
                            setTimeout(attemptUpload, 3000 * attempts);
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

const supportImageUpload = (req, res, next) => {
    if (req.is('multipart/form-data')) {
        return upload.single('message_img')(req, res, (err) => {
            if (err) {
                console.error('Multer upload error:', err);
                return res.status(400).json({
                    status: 'error',
                    message: 'File upload failed',
                    error: err.message
                });
            }
            next();
        });
    }
    next();
};

// create a new ticket 
const createTicket = async (req, res) => {
    try {
        console.log('createTicket body:', req.body);
        console.log('createTicket file:', req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : 'No file');

        const { user_id, username, email, subject, message, ticket_source } = req.body;
        if (!user_id || !username || !email || !subject || !message) {
            return res.status(400).json({
                status: 'error',
                error: "MISSING FIELDS",
                message: ERROR_MESSAGES.MISSING_FIELDS
            })
        }

        // Validate ticket source - must be either 'website' or 'mobile_app'
        const ALLOWED_SOURCES = ["website", "mobile_app"];
        const normalizedSource = ticket_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
        const validSource = ALLOWED_SOURCES.includes(normalizedSource) ? normalizedSource : "website";

        let message_img = null;
        if (req.file) {
            try {
                const fileBuffer = req.file.buffer;
                const originalName = req.file.originalname;
                message_img = await uploadToCloudinary(fileBuffer, user_id, `${originalName}`)
            } catch (error) {
                console.error("Error uploading support image", error);
                return res.status(500).json({
                    status: "error",
                    message: "Failed to upload the Image",
                    error: error.message
                })
            }
        }

        const [rows] = await queryDatabase(
            `SELECT ticket_id FROM ${TABLES.USER_SUPPORT} WHERE ticket_id IS NOT NULL ORDER BY ticket_id DESC LIMIT 1`
        )

        let newTicketId = 12000
        if (rows.length > 0) {
            newTicketId = rows[0].ticket_id + 1
        }

        const sql = `INSERT INTO ${TABLES.USER_SUPPORT} (ticket_id,user_id,username,email,subject,message,message_img,created_at,updated_at,status,chat_ended, ticket_source) VALUES (?,?,?,?, ?,?,?,NOW(),NOW(),'open','no', ?)`;

        const [result] = await queryDatabase(sql, [newTicketId, user_id, username, email, subject, message, message_img, validSource]);

        const [messageResult] = await queryDatabase(
            `INSERT INTO ${TABLES.SUPPORT_MESSAGES} (ticket_id, sender_type, sender_id, message, message_img, created_at)
             VALUES (?, 'user', ?, ?, ?, NOW())`,
            [newTicketId, user_id, message, message_img]
        );

        console.log('createTicket support message insert result:', messageResult);
        console.log('Ticket created, Source:', validSource);

        res.status(201).json({
            status: "success",
            message: SUCCESS_MESSAGES.TICKET_CREATED,
            id: result.insertId,
            ticket_id: newTicketId.toString().padStart(5, "0"),
            ticket_source: validSource
        })

    } catch (error) {
        console.error('Failed to create ticket', error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        })
    }
}

// get tickets only from single user login
const getTicketByUserId = async (req, res) => {
    try {
        const { user_id } = req.params

        if (!user_id) {
            return res.status(400).json({
                status: "error",
                message: "User Id is required"
            })
        }

        const sql = `SELECT ticket_id, user_id, subject, created_at, updated_at, status, chat_ended, ticket_source FROM ${TABLES.USER_SUPPORT} WHERE user_id = ? ORDER BY created_at DESC`
        const [rows] = await queryDatabase(sql, [user_id])

        res.json(rows)
    } catch (error) {
        console.error("Failed to Fetch tickets by user_id", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        })
    }
}

// Get all tickets - SORTED BY PROFESSIONAL LOGIC
const getTickets = async (req, res) => {
    try {
        const sql = `SELECT * FROM ${TABLES.USER_SUPPORT} 
                     ORDER BY 
                        CASE 
                            WHEN status = 'open' THEN 0 
                            ELSE 1 
                        END,
                        COALESCE(updated_at, created_at) DESC,
                        created_at DESC`
        const [rows] = await queryDatabase(sql)
        res.json(rows)
    } catch (error) {
        console.error("Failed to Fetch tickets", error)
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        })
    }
}

// Get single ticket by ticket_id
const getTicketById = async (req, res) => {
    try {
        const { ticket_id } = req.params
        const sql = `SELECT ticket_id, user_id, username, email, subject, created_at, updated_at, status, chat_ended, closed_by_admin_id, closed_by_admin_name, ticket_source FROM ${TABLES.USER_SUPPORT} WHERE ticket_id=?`
        const [rows] = await queryDatabase(sql, [ticket_id]);

        if (rows.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Ticket not found"
            })
        }
        res.json(rows[0])

    } catch (error) {
        console.error("Failed to fetch ticket", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        })
    }
}

// UPDATED: Reply to a ticket with chat_ended check
const replyToTicket = async (req, res) => {
    try {
        // console.log('replyToTicket headers:', req.headers);
        // console.log('replyToTicket params:', req.params);
        // console.log('replyToTicket body:', req.body);
        // console.log('replyToTicket file:', req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : 'No file');

        const { ticket_id } = req.params;
        const {
            sender_type,
            sender_id,
            message,
            closed_by_admin_id,
            closed_by_admin_name
        } = req.body;

        const trimmedMessage = message ? message.trim() : '';

        if (!trimmedMessage && !req.file) {
            return res.status(400).json({
                status: "error",
                message: "At least a message or an image is required"
            });
        }

        if (!sender_type || !sender_id) {
            return res.status(400).json({
                status: "error",
                message: ERROR_MESSAGES.MISSING_FIELDS
            });
        }

        if (!['user', 'admin'].includes(sender_type)) {
            return res.status(400).json({
                status: "error",
                message: "sender_type must be either 'user' or 'admin'"
            });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({
                status: "error",
                message: "Only image files are allowed"
            });
        }

        // Check ticket exists
        const [ticketRows] = await queryDatabase(
            `SELECT chat_ended FROM ${TABLES.USER_SUPPORT}
             WHERE ticket_id=?`,
            [ticket_id]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Ticket not found"
            });
        }

        // BLOCK USER REPLIES IF CHAT IS ENDED
        if (ticketRows[0].chat_ended === "yes" && sender_type === "user") {
            return res.status(403).json({
                status: "error",
                message: "This support chat has been ended by admin. Please create a new ticket for further assistance."
            });
        }

        let message_img = null;

        // Upload image if exists
        if (req.file) {
            try {
                console.log('Uploading image to Cloudinary...');
                const fileBuffer = req.file.buffer;
                const originalName = req.file.originalname;
                message_img = await uploadToCloudinary(
                    fileBuffer,
                    `support_chat/${sender_id}`,
                    originalName
                );
                console.log('Cloudinary URL:', message_img);
            } catch (error) {
                console.error('Cloudinary Upload Error:', error);
                return res.status(500).json({
                    status: "error",
                    message: "Cloudinary upload failed",
                    error: error.message
                });
            }
        }

        // Insert message
        const [messageResult] = await queryDatabase(
            `INSERT INTO ${TABLES.SUPPORT_MESSAGES}
            (
                ticket_id,
                sender_type,
                sender_id,
                message,
                message_img,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                ticket_id,
                sender_type,
                sender_id,
                trimmedMessage || null,
                message_img
            ]
        );

        // console.log('replyToTicket message insert result:', messageResult);

        // AUTOMATIC STATUS UPDATE BASED ON SENDER TYPE
        let ticketStatus = sender_type === "user" ? "open" : "closed";

        console.log(`Ticket ${ticket_id} status updated to ${ticketStatus}`);

            // UPDATE TICKET STATUS AND ACTIVITY
        // If admin replies → also save admin name (since it auto-closes)
        if (sender_type === "admin") {
            await queryDatabase(
                `UPDATE ${TABLES.USER_SUPPORT}
                 SET status = 'closed',
                     updated_at = NOW(),
                     closed_by_admin_id = ?,
                     closed_by_admin_name = ?
                 WHERE ticket_id = ?`,
                [closed_by_admin_id || sender_id, closed_by_admin_name || 'Admin', ticket_id]
            );
        } else {
            await queryDatabase(
                `UPDATE ${TABLES.USER_SUPPORT}
                 SET status = 'open',
                     updated_at = NOW()
                 WHERE ticket_id = ?`,
                [ticket_id]
            );
        }

        res.json({
            status: "success",
            message: "Reply sent successfully",
            ticket_status: ticketStatus,
            data: {
                ticket_id: parseInt(ticket_id),
                sender_type,
                message: trimmedMessage || null,
                message_img
            }
        });

    } catch (error) {
        console.error("Reply error:", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

// ...existing code...
const sendMessage = async (req, res) => {
    try {
        const { ticket_id } = req.params;

          const {
            sender_type,
            sender_id,
            message,
            closed_by_admin_id,
            closed_by_admin_name
        } = req.body;
        if (!message) {
            return res.status(400).json({
                status: "error",
                message: "Message required"
            });
        }

        // Check ticket exists and chat_ended status
        const [ticketRows] = await queryDatabase(
            `SELECT chat_ended FROM ${TABLES.USER_SUPPORT}
             WHERE ticket_id=?`,
            [ticket_id]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Ticket not found"
            });
        }

        // BLOCK USER REPLIES IF CHAT IS ENDED
        if (ticketRows[0].chat_ended === "yes" && sender_type === "user") {
            return res.status(403).json({
                status: "error",
                message: "This support chat has been ended by admin. Please create a new ticket for further assistance."
            });
        }

        let message_img = null;

        // Upload image
        if (req.file) {
            message_img = await uploadToCloudinary(
                req.file.buffer,
                sender_id,
                req.file.originalname
            );
        }

        // Save message
        await queryDatabase(
            `INSERT INTO ${TABLES.SUPPORT_MESSAGES}
            (
                ticket_id,
                sender_type,
                sender_id,
                message,
                message_img,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                ticket_id,
                sender_type,
                sender_id,
                message,
                message_img
            ]
        );

        // UPDATE TICKET STATUS AND ACTIVITY
        let ticketStatus = sender_type === "user" ? "open" : "closed";

        await queryDatabase(
            `UPDATE ${TABLES.USER_SUPPORT}
             SET status = ?,
                 updated_at = NOW()
             WHERE ticket_id = ?`,
            [ticketStatus, ticket_id]
        );

        res.json({
            status: "success",
            message: "Message sent",
            ticket_status: ticketStatus
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

// ...existing code...
const getMessages = async (req, res) => {
    try {
        // console.log('getMessages params:', req.params);

        const { ticket_id } = req.params;
        
        const [messages] = await queryDatabase(
            `SELECT *
             FROM ${TABLES.SUPPORT_MESSAGES}
             WHERE ticket_id=?
             ORDER BY created_at ASC`,
            [ticket_id]
        );

        // console.log('getMessages result count:', messages.length);

        res.json({
            status: "success",
            data: messages
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

// NEW: End chat (Admin only)
const endChat = async (req, res) => {
    try {
        console.log('endChat params:', req.params);

        const { ticket_id } = req.params;
        const { closed_by_admin_id, closed_by_admin_name } = req.body || {};

        // Check ticket exists
        const [ticketRows] = await queryDatabase(
            `SELECT chat_ended FROM ${TABLES.USER_SUPPORT}
             WHERE ticket_id = ?`,
            [ticket_id]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Ticket not found"
            });
        }

        // Update chat_ended status
        await queryDatabase(
            `UPDATE ${TABLES.USER_SUPPORT}
             SET
                chat_ended = 'yes',
                status = 'closed',
                updated_at = NOW(),
                closed_by_admin_id = ?,
                closed_by_admin_name = ?
             WHERE ticket_id = ?`,
            [closed_by_admin_id || null, closed_by_admin_name || null, ticket_id]
        );

        console.log(`Chat ended for ticket ${ticket_id}`);

        res.json({
            status: "success",
            message: "Chat ended successfully",
            ticket_id: parseInt(ticket_id)
        });

    } catch (error) {
        console.error("End chat error:", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

// NEW: Reopen chat (Admin only)
const reopenChat = async (req, res) => {
    try {
        console.log('reopenChat params:', req.params);

        const { ticket_id } = req.params;

        // Check ticket exists
        const [ticketRows] = await queryDatabase(
            `SELECT chat_ended FROM ${TABLES.USER_SUPPORT}
             WHERE ticket_id = ?`,
            [ticket_id]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Ticket not found"
            });
        }

        // Update chat_ended status
        await queryDatabase(
            `UPDATE ${TABLES.USER_SUPPORT}
             SET
                chat_ended = 'no',
                status = 'open',
                updated_at = NOW()
             WHERE ticket_id = ?`,
            [ticket_id]
        );

        console.log(`Chat reopened for ticket ${ticket_id}`);

        res.json({
            status: "success",
            message: "Chat reopened successfully",
            ticket_id: parseInt(ticket_id)
        });

    } catch (error) {
        console.error("Reopen chat error:", error);
        res.status(500).json({
            status: "error",
            message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

const markMessagesAsSeen = async (req, res) => {
    try {
        const { ticket_id } = req.params;

        await queryDatabase(
            `UPDATE support_messages
             SET is_seen = 1
             WHERE ticket_id = ?
             AND sender_type = 'admin'
             AND is_seen = 0`,
            [ticket_id]
        );

        res.status(200).json({
            success: true,
            message: "Messages marked as seen"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

module.exports = { 
    supportImageUpload, 
    createTicket, 
    getTickets, 
    getTicketById, 
    replyToTicket, 
    getTicketByUserId, 
    sendMessage, 
    getMessages,
    endChat,
    reopenChat,
    markMessagesAsSeen
}

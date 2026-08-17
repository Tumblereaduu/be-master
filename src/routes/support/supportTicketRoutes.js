const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const verifyToken = require("../../config/verifyToken");

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file && file.mimetype && file.mimetype.startsWith("image/")) {
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const extname = path.extname(file.originalname).toLowerCase();
            if (allowedExtensions.includes(extname)) {
                return cb(null, true);
            }
        }
        cb(new Error('Only image files (jpg, jpeg, png, webp, gif) are allowed!'));
    }
});

const supportTicketController = require("../../controllers/support/supportTicket");
const uploadSingle = upload.single("message_img");

// create ticket - protected
router.post("/", verifyToken, uploadSingle, supportTicketController.createTicket);

// Get all tickets - protected
router.get("/", verifyToken, supportTicketController.getTickets);

// show the ticket by login id - protected
router.get('/support/user/:user_id', verifyToken, supportTicketController.getTicketByUserId);

// Get messages for a specific ticket - protected
router.get("/messages/:ticket_id", verifyToken, supportTicketController.getMessages);

// Get single ticket by ticket_id - protected
router.get("/:ticket_id", verifyToken, supportTicketController.getTicketById);

// Reply to a ticket (user or admin) - protected
router.post("/reply/:ticket_id", verifyToken, uploadSingle, supportTicketController.replyToTicket);
router.put("/:ticket_id/reply", verifyToken, uploadSingle, supportTicketController.replyToTicket);

// Close ticket - protected
router.put("/close/:ticket_id", verifyToken, supportTicketController.endChat);

// Reopen ticket - protected
router.put("/reopen/:ticket_id", verifyToken, supportTicketController.reopenChat);

// Mark as seen - protected
router.put("/messages/seen/:ticket_id", verifyToken, supportTicketController.markMessagesAsSeen);


module.exports = router;

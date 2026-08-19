const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

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

// create ticket
router.post("/", uploadSingle, supportTicketController.createTicket);

// Get all tickets
router.get("/", supportTicketController.getTickets);

// show the ticket by login id

router.get('/support/user/:user_id', supportTicketController.getTicketByUserId);

// Get messages for a specific ticket
router.get("/messages/:ticket_id", supportTicketController.getMessages);

// Get single ticket by ticket_id
router.get("/:ticket_id", supportTicketController.getTicketById);

// Reply to a ticket (user or admin)
router.post("/reply/:ticket_id", uploadSingle, supportTicketController.replyToTicket);
router.put("/:ticket_id/reply", uploadSingle, supportTicketController.replyToTicket);

router.put("/close/:ticket_id", supportTicketController.endChat);

router.put("/reopen/:ticket_id", supportTicketController.reopenChat);

router.put("/messages/seen/:ticket_id", supportTicketController.markMessagesAsSeen);


module.exports = router;

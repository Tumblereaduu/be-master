const express = require('express');
const router = express.Router();
const emailController = require("../../controllers/emailPhone/EmailController");

router.get("/",emailController.getPhoneEmail);
router.post("/",emailController.addPhoneEmail);
router.put("/",emailController.updateEmail);

module.exports = router;

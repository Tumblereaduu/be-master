const express = require('express')
const router = express.Router()
const verifyToken = require('../../config/verifyToken');
const multer = require('multer');
const upload = multer();

const withdrawalController = require("../../controllers/withdrawal/withdrawalController")
const { withdrawalPaymentUpload } = require("../../controllers/withdrawal/withdrawalController");

router.post('/', verifyToken, withdrawalPaymentUpload, withdrawalController.createWithdrawal)

router.get('/', verifyToken, withdrawalController.getWithdrawals)

router.get('/:id', verifyToken, withdrawalController.getWithdrawalById)

router.get('/user/:userId', verifyToken, withdrawalController.getWithdrawalByUserId)

router.get('/admin/user/:userId', verifyToken, withdrawalController.getAdminWithdrawalByUserId)

router.put('/:id/status', verifyToken, withdrawalController.updateWithdrawalStatus)

router.put("/:id/hide", verifyToken, withdrawalController.hideWithdrawal)

router.put("/:id/unhide", verifyToken, withdrawalController.restoreWithdrawal)

module.exports = router;

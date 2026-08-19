const express = require('express')
const router = express.Router()
const multer = require('multer');
const upload = multer();

const withdrawalController = require("../../controllers/withdrawal/withdrawalController")
const { withdrawalPaymentUpload } = require("../../controllers/withdrawal/withdrawalController");

router.post('/',withdrawalPaymentUpload, withdrawalController.createWithdrawal)

router.get('/', withdrawalController.getWithdrawals)

router.get('/:id', withdrawalController.getWithdrawalById)

router.get('/user/:userId',withdrawalController.getWithdrawalByUserId)

router.get('/admin/user/:userId',withdrawalController.getAdminWithdrawalByUserId)

router.put('/:id/status', withdrawalController.updateWithdrawalStatus)

router.put("/:id/hide", withdrawalController.hideWithdrawal)

router.put("/:id/unhide", withdrawalController.restoreWithdrawal)

module.exports = router;

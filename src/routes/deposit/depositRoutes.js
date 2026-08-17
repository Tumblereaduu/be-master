const express = require("express");
const router = express.Router();
const verifyToken = require("../../config/verifyToken");
const depositController = require("../../controllers/deposit/depositController");

router.post('/create', verifyToken, depositController.depositPaymentUpload, depositController.createDeposit);
router.get("/list/all", verifyToken, depositController.getAllDepositList);
router.get("/list/:id", verifyToken, depositController.getDepositById);
router.get("/list/user/:id", verifyToken, depositController.getDepositsByUserId);
router.get("/admin/list/user/:id", verifyToken, depositController.getAdminDepositsByUserId);
router.put("/update/:id", verifyToken, depositController.updateDepositByID);
router.put("/:id/hide", verifyToken, depositController.hideDeposit);
router.put("/:id/unhide", verifyToken, depositController.restoreDeposit);

module.exports = router;

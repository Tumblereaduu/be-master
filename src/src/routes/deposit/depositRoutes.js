const express = require("express");
const router = express.Router();
const depositController = require("../../controllers/deposit/depositController");

router.post('/create', depositController.depositPaymentUpload, depositController.createDeposit);
router.get("/list/all", depositController.getAllDepositList);
router.get("/list/:id", depositController.getDepositById);
router.get("/list/user/:id", depositController.getDepositsByUserId);
router.get("/admin/list/user/:id", depositController.getAdminDepositsByUserId);
router.put("/update/:id", depositController.updateDepositByID);
router.put("/:id/hide", depositController.hideDeposit);
router.put("/:id/unhide", depositController.restoreDeposit);

module.exports = router;

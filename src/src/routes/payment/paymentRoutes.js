const express = require('express');
const router = express.Router();

const paymentController = require("../../controllers/paymentMethod/paymentController");

router.post("/create", paymentController.paymentUpload, paymentController.paymentMode);
router.get("/payments", paymentController.getAllpaymentMode);
router.get("/getactive", paymentController.getActivePaymentModes);
router.get("/get", paymentController.getPaymentByParams);
router.get("/admin/get", paymentController.getAdminPaymentByParams);
router.get("/:id", paymentController.getPaymentModeById);
router.put("/toggle-is-used/:id",paymentController.toggleIsUsed);
router.delete("/delete/:id", paymentController.deletePaymentMode);
router.put("/update/:id", paymentController.paymentUpload, paymentController.updatePaymentMode);

module.exports = router;

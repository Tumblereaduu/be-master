const express = require('express');
const router = express.Router();
const verifyToken = require('../../config/verifyToken');
const { allowAdmin } = require('../../middleware/rbacMiddleware');

const paymentController = require("../../controllers/paymentMethod/paymentController");

// Admin-only routes
router.post("/create", verifyToken, allowAdmin, paymentController.paymentUpload, paymentController.paymentMode);
router.get("/payments", verifyToken, allowAdmin, paymentController.getAllpaymentMode);
router.get("/get", verifyToken, allowAdmin, paymentController.getPaymentByParams);
router.get("/admin/get", verifyToken, allowAdmin, paymentController.getAdminPaymentByParams);
router.put("/toggle-is-used/:id", verifyToken, allowAdmin, paymentController.toggleIsUsed);
router.delete("/delete/:id", verifyToken, allowAdmin, paymentController.deletePaymentMode);
router.put("/update/:id", verifyToken, allowAdmin, paymentController.paymentUpload, paymentController.updatePaymentMode);

// Public routes (payment methods for users)
router.get("/getactive", paymentController.getActivePaymentModes);
router.get("/:id", paymentController.getPaymentModeById);

module.exports = router;

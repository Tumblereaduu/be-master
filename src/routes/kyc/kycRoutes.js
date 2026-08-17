
const express = require("express");
const router = express.Router();
const kycController = require("../../controllers/kyc/kycController");

router.get('/admin/kyc', kycController.getAllKYC);
router.get("/admin/kyc/:id", kycController.userKYC);
router.get('/status/:id', kycController.getKYCStatus);
router.post('/submit', kycController.kycDocumentUpload, kycController.submitKYCDetails);
router.post("/save-popup",kycController.savePopupData);
router.patch('/admin/kyc/:id/status',kycController.updateKYCStatus);
router.post("/upload",kycController.kycDocumentUpload,kycController.submitKYCDetails); 

module.exports = router;

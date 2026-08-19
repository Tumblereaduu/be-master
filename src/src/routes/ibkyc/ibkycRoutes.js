const express = require("express");
const router = express.Router();
const ibkycController = require("../../controllers/ibkyc/ibkycController");

const verifyToken = require("../../config/verifyToken");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/ib/kyc", verifyToken, upload.fields([
  { name: "ib_kyc_id_1", maxCount: 1 },
  { name: "ib_kyc_id_2", maxCount: 1 },
  { name: "ib_kyc_id_3", maxCount: 1 },
  { name: "ib_kyc_id_4", maxCount: 1 },
  { name: "ib_kyc_id_5", maxCount: 1 },
  { name: "ib_kyc_id_6", maxCount: 1 },
]),
  ibkycController.submitIBKYC);
router.get("/ib/get-all", verifyToken, ibkycController.getIBKYC);
router.get('/admin/ib/kyc', ibkycController.getIBAllKYC);
router.get("/admin/kyc/ib/:id", ibkycController.userIBKYC);
router.patch('/admin/kyc/ib/:user_id/status', ibkycController.updateIBKYCStatus);
router.get('/status/ib/:user_id', ibkycController.getIBKYCStatus);

module.exports = router;

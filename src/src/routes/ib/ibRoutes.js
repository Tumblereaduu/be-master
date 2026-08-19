const express = require("express");
const router = express.Router();
const ibController = require("../../controllers/ib/ibController")
const ibDepositController = require("../../controllers/ib/ibDeposit");
const verifyToken = require("../../config/verifyToken");

router.get('/commission', ibController.getCommission);

router.put('/commission', ibController.updateCommission);

router.get('/ib-get/:user_id', ibDepositController.getListbbyUserId);

router.get('/list/all', ibDepositController.getAllDepositList);

router.get('/list/:user_id', ibDepositController.getIBDepositById);

router.post('/ib-deposit', verifyToken, ibDepositController.createIBDeposit);

router.put('/update/:ib_id', ibDepositController.updateIBDepositByID);

router.get("/total-earnings/:user_id", ibDepositController.getIBTotalEarnings);

router.get('/dashboard-stats', verifyToken, ibDepositController.getIBDashboardStats);

router.get('/earnings-clients-data/:user_id', ibDepositController.getIBDashboardClients);

router.get('/commission/:user_id', ibDepositController.getIBCommissionDetails);

router.get('/all/commission', ibDepositController.getAllCommission);


module.exports = router;

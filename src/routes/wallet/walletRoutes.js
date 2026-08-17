const express = require("express");
const router = express.Router();
const verifyToken = require("../../config/verifyToken");
const walletController = require("../../controllers/wallet/walletController")

router.post('/', verifyToken, walletController.addFund);
router.get('/history', verifyToken, walletController.getFundHistory)
router.get('/wallethistory', verifyToken, walletController.getWalletHistory)
router.put('/update', verifyToken, walletController.updateWallet);
router.get('/:user_id', verifyToken, walletController.getWalletByUserId);


module.exports = router;
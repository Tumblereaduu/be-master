const express = require("express");
const router = express.Router();

const walletController = require("../../controllers/wallet/walletController")

router.post('/', walletController.addFund);
router.get('/history',walletController.getFundHistory)
router.get('/wallethistory',walletController.getWalletHistory)
router.put('/update', walletController.updateWallet);
router.get('/:user_id', walletController.getWalletByUserId);


module.exports = router;
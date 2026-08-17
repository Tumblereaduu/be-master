const express = require('express');
const router = express.Router();

const demoAccount  = require('../../controllers/demoAccount/demoAccountControllers');

router.post('/demo-account', demoAccount.demoAccount)

router.get('/demo-account/:user_id',demoAccount.getAccountBalance)

router.put('/demo/account-type/:user_id',demoAccount.accountType)

router.get('/demo/fund-history/:user_id', demoAccount.getDemoFundHistory);

router.get('/demo/analytics/:user_id', demoAccount.getDemoAnalytics);

module.exports = router;
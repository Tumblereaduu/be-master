const express = require('express');
const router = express.Router();
const forgeController = require('../../controllers/1forge/1forgeController');

router.get('/status', forgeController.getStatus);
router.get('/prices', forgeController.getAllPrices);
router.get('/prices/:symbol', forgeController.getPriceBySymbol);
router.get('/history/:symbol', forgeController.getHistoryBySymbol);

module.exports = router;

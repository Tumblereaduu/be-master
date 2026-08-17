const express = require('express');
const router = express.Router();
const spreadController = require("../../controllers/orders/spreadController");

router.get("/getspread",spreadController.ViewSymbol);
router.get("/getspread/:id",spreadController.ViewSymbolById);
router.post("/addspread",spreadController.createSymbol);
router.put("/updateSpread/:id",spreadController.updateSymbol);
router.put('/user/spread/:id',spreadController.updateSpread);
router.get('/user-spreads/:id', spreadController.getUserSpreads);
router.put('/user-spreads/:id', spreadController.setUserSpread);
router.delete('/user-spreads/:id/:spreadId', spreadController.removeUserSpread);

module.exports = router;

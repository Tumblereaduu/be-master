const express = require("express");
const router = express.Router();

const oandaController = require("../../controllers/oanda/oandaController")

router.get("/Oandaprice/:pair", oandaController.oandaprice);

module.exports = router;

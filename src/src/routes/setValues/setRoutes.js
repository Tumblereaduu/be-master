const express = require("express");
const router = express.Router();

const setValue = require("../../controllers/setValues/setValuesController")

router.post("/", setValue.adminRate);
router.get("/getdata", setValue.getAdminRate)

module.exports = router;

const express = require("express");
const router = express.Router();

const {
    getCurrentTenant
} = require("../../controllers/master/tenantController");

router.get("/current", getCurrentTenant);

module.exports = router;
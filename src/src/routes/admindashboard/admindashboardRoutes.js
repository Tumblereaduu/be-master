const express = require('express');
const router = express.Router();

const admindash = require("../../controllers/admindashboard/adminDashboardController")

router.get("/", admindash.getAdminDashboard);
router.get("/timerange",admindash.getTimeRange);
router.get("/analytics/:user_id",admindash.getAnalytics);
router.get('/lp-status',admindash.getAllLP);

module.exports = router;

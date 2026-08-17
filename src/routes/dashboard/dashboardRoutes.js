const express = require("express");
const router = express.Router();
const dashboardController = require("../../controllers/dashboard/dashboardController");
const verifyToken = require("../../config/verifyToken");
const { allowMaster, allowAdmin, allowUser } = require("../../middleware/rbacMiddleware");

// ============================================================================
// MASTER DASHBOARD ROUTES
// ============================================================================

// Master dashboard overview
router.get("/master/stats",verifyToken,allowMaster,dashboardController.getMasterDashboard);

// Master recent users
router.get("/master/recent-users",verifyToken,allowMaster,dashboardController.getMasterRecentUsers);

// ============================================================================
// ADMIN DASHBOARD ROUTES
// ============================================================================

// Admin dashboard overview (filtered to their users)
router.get("/admin/dashboard",verifyToken,allowAdmin,dashboardController.getAdminDashboard);

// Admin recent users (their users only)
router.get("/admin/recent-users",verifyToken,allowAdmin,dashboardController.getAdminRecentUsers);

// ============================================================================
// USER DASHBOARD ROUTES
// ============================================================================

// User dashboard overview (their account only)
router.get("/user/dashboard",verifyToken,allowUser,dashboardController.getUserDashboard);

// User recent trades
router.get("/user/trades",verifyToken,allowUser,dashboardController.getUserRecentTrades);

// User recent transactions (deposits/withdrawals)
router.get("/user/transactions",verifyToken,allowUser,dashboardController.getUserRecentTransactions);

module.exports = router;

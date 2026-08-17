const express = require("express");
const router = express.Router();
const masterAdminController = require("../../controllers/master/masterAdminController");
const verifyToken = require("../../config/verifyToken");
const { loginRateLimiter } = require("../../middleware/loginRateLimiter");

// ============================================================================
// MASTER ADMIN AUTHENTICATION ROUTES
// ============================================================================

// POST /api/master/login
// Master admin login (no authentication required)
// TASK 5: Apply rate limiting to prevent brute force attacks
router.post("/login", loginRateLimiter, masterAdminController.masterLogin);

// GET /api/master/profile
// Get master admin profile (requires authentication)
router.get("/profile", verifyToken, masterAdminController.getMasterProfile);

// PUT /api/master/change-password
// Change master admin password (requires authentication)
router.put("/change-password", verifyToken, masterAdminController.changePassword);

// POST /api/master/logout
// Logout master admin (requires authentication)
router.post("/logout", verifyToken, masterAdminController.logout);

module.exports = router;

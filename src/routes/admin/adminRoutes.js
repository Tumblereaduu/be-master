const express = require('express');
const router = express.Router();
const adminController = require("../../controllers/admin/adminController");
const verifyToken = require("../../config/verifyToken");
const { allowMaster, allowAdmin, tenantMiddleware } = require("../../middleware/rbacMiddleware");
const { loginRateLimiter } = require("../../middleware/loginRateLimiter");

// Create Admin (Master only)
// POST /admin/
// Requires: verifyToken + allowMaster
router.post('/', verifyToken, allowMaster, adminController.addAdmin);

// Admin Login (Public - no auth required)
// POST /admin/login
// TASK 5: Apply rate limiting to prevent brute force attacks
router.post('/login', loginRateLimiter, adminController.adminLogin);

// Get All Admins (Master and Admin roles)
// GET /admin/admins
// Requires: verifyToken + allowAdmin (both master and admin can view)
router.get('/admins', verifyToken, allowAdmin, adminController.getAdmin);

// Get Admin by ID (Master and Admin roles)
// GET /admin/admin/:id
// Requires: verifyToken + allowAdmin (both master and admin can view)
router.get("/admin/:id", verifyToken, allowAdmin, adminController.getAdminById);

// Update Admin (Master only)
// PUT /admin/admin/update/:id
// Requires: verifyToken + allowMaster
router.put("/admin/update/:id", verifyToken, allowMaster, adminController.updateAdmin);

// Admin Logout (PHASE 1: Production Hardening)
// POST /admin/logout
// Requires: verifyToken + (admin or master role)
router.post("/logout", verifyToken, adminController.adminLogout);

module.exports = router;

const express = require("express");
const router = express.Router();
const adminManagementController = require("../../controllers/master/adminManagementController");
const verifyToken = require("../../config/verifyToken");
const { allowMaster } = require("../../middleware/rbacMiddleware");

// ============================================================================
// ADMIN MANAGEMENT ROUTES
// ============================================================================
// All routes require: verifyToken + allowMaster()
// Master only - Cannot be accessed by Admin or User roles

// ============================================================================
// 1. CREATE ADMIN
// ============================================================================
// POST /api/master/admins
// Create new admin under this master
router.post("/",verifyToken,allowMaster,adminManagementController.createAdmin);

// ============================================================================
// 2. LIST ALL ADMINS
// ============================================================================
// GET /api/master/ada mins
// List all admins with pagination, search, sort, filter
router.get("/",verifyToken,allowMaster,adminManagementController.listAllAdmins);

// ============================================================================
// 3. GET ADMIN BY ID
// ============================================================================
// GET /api/master/admins/:id
// Get single admin details
router.get("/:id",verifyToken,allowMaster,adminManagementController.getAdminById);

// ============================================================================
// 4. UPDATE ADMIN
// ============================================================================
// PUT /api/master/admins/:id
// Update admin (admin_name, email_id, phone, domain, permission, status)
router.put("/:id",verifyToken,allowMaster,adminManagementController.updateAdmin);

// ============================================================================
// 5. PATCH ADMIN STATUS
// ============================================================================
// PATCH /api/master/admins/:id/status
// Toggle admin status (active/inactive)
router.patch(
  "/:id/status",
  verifyToken,
  allowMaster,
  adminManagementController.patchAdminStatus
);

// ============================================================================
// 6. RESET ADMIN PASSWORD
// ============================================================================
// POST /api/master/admins/:id/reset-password
// Reset admin password and force logout
router.post(
  "/:id/reset-password",
  verifyToken,
  allowMaster,
  adminManagementController.resetAdminPassword
);

// ============================================================================
// 7. DELETE ADMIN (Soft Delete)
// ============================================================================
// DELETE /api/master/admins/:id
// Soft delete admin (doesn't remove from database)
router.delete(
  "/:id",
  verifyToken,
  allowMaster,
  adminManagementController.deleteAdmin
);

module.exports = router;

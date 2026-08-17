const express = require("express");
const router = express.Router();
const userManagementController = require("../../controllers/admin/userManagementController");
const verifyToken = require("../../config/verifyToken");
const { allowAdmin } = require("../../middleware/rbacMiddleware");

// ============================================================================
// USER MANAGEMENT ROUTES - ADMIN ONLY
// ============================================================================
// All routes require: verifyToken + allowAdmin()
// Admin can only manage their own users
// Master can view/manage all users (admin operations)

// ============================================================================
// 1. CREATE USER
// ============================================================================
// POST /api/admin/users
// Create new user under this admin
router.post(
  "/",
  verifyToken,
  allowAdmin,
  userManagementController.createUser
);

// ============================================================================
// 2. LIST USERS
// ============================================================================
// GET /api/admin/users
// List all users belonging to this admin with pagination, search, sort, filter
router.get(
  "/",
  verifyToken,
  allowAdmin,
  userManagementController.listUsers
);

// ============================================================================
// 3. GET USER BY ID
// ============================================================================
// GET /api/admin/users/:id
// Get single user details (must belong to this admin)
router.get(
  "/:id",
  verifyToken,
  allowAdmin,
  userManagementController.getUserById
);

// ============================================================================
// 4. UPDATE USER
// ============================================================================
// PUT /api/admin/users/:id
// Update user (username, email, phone, status)
router.put(
  "/:id",
  verifyToken,
  allowAdmin,
  userManagementController.updateUser
);

// ============================================================================
// 5. PATCH USER STATUS
// ============================================================================
// PATCH /api/admin/users/:id/status
// Toggle user status (active/inactive)
router.patch(
  "/:id/status",
  verifyToken,
  allowAdmin,
  userManagementController.patchUserStatus
);

// ============================================================================
// 6. RESET USER PASSWORD
// ============================================================================
// POST /api/admin/users/:id/reset-password
// Reset user password and force logout
router.post(
  "/:id/reset-password",
  verifyToken,
  allowAdmin,
  userManagementController.resetUserPassword
);

// ============================================================================
// 7. DELETE USER (Soft Delete)
// ============================================================================
// DELETE /api/admin/users/:id
// Soft delete user (doesn't remove from database)
router.delete(
  "/:id",
  verifyToken,
  allowAdmin,
  userManagementController.deleteUser
);

module.exports = router;

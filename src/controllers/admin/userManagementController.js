const { queryDatabase } = require("../../config/db");
const bcrypt = require("bcrypt");
const { TABLES } = require("../../config/tables");
const { BCRYPT_SALT_ROUNDS } = require("../../config/constants");
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require("../../utils/errors");

// ============================================================================
// PASSWORD VALIDATION - PHASE 1: Production Hardening
// ============================================================================
// Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
};

// ============================================================================
// 1. CREATE USER
// ============================================================================
// POST /api/admin/users
// Admin only - Create new user under this admin
const createUser = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const masterId = req.user?.master_id;
    const role = req.user?.role;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    const { username, email, password, phone } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "username, email, and password are required"
      });
    }

    // Validate password complexity (PHASE 1: Production Hardening)
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        status: "error",
        message: passwordError
      });
    }

    // Validate username uniqueness
    const usernameCheckSql = `SELECT id FROM ${TABLES.REGISTER} WHERE username = ? AND deleted_at IS NULL`;
    const [usernameRows] = await queryDatabase(usernameCheckSql, [username]);
    if (usernameRows && usernameRows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Username already exists"
      });
    }

    // Validate email uniqueness
    const emailCheckSql = `SELECT id FROM ${TABLES.REGISTER} WHERE email = ? AND deleted_at IS NULL`;
    const [emailRows] = await queryDatabase(emailCheckSql, [email]);
    if (emailRows && emailRows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Email already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS || 12);

    // Insert new user
    const insertSql = `
      INSERT INTO ${TABLES.REGISTER}
      (username, email, password, phone, admin_id, master_id, user_status, token_version, account_created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await queryDatabase(insertSql, [
      username,
      email,
      hashedPassword,
      phone || null,
      adminId,
      masterId,
      "active",
      1
    ]);

    return res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: {
        username,
        email,
        phone: phone || null,
        user_status: "active"
      }
    });

  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error creating user"
    });
  }
};

// ============================================================================
// 2. LIST USERS (Admin)
// ============================================================================
// GET /api/admin/users
// Admin only - List all users belonging to this admin
const listUsers = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Search parameter
    const search = req.query.search || "";

    // Sort parameter
    const sortBy = req.query.sortBy || "account_created_at";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

    // Filter by status
    const status = req.query.status || null;

    // Build WHERE clause
    let whereClause = `WHERE admin_id = ? AND deleted_at IS NULL`;
    let params = [adminId];

    // Add search filter
    if (search) {
      whereClause += ` AND (username LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Add status filter
    if (status) {
      whereClause += ` AND user_status = ?`;
      params.push(status);
    }

    // Count total records
    const countSql = `SELECT COUNT(*) as total FROM ${TABLES.REGISTER} ${whereClause}`;
    const [countResult] = await queryDatabase(countSql, params);
    const total = countResult[0]?.total || 0;

    // Fetch paginated data
    const dataParams = [...params];
    const fetchSql = `
      SELECT id, username, email, phone, user_status, account_created_at, updated_at
      FROM ${TABLES.REGISTER}
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    dataParams.push(limit, offset);

    const [users] = await queryDatabase(fetchSql, dataParams);

    return res.status(200).json({
      status: "success",
      message: "Users retrieved successfully",
      data: {
        users: users || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving users"
    });
  }
};

// ============================================================================
// 3. GET USER BY ID (Admin)
// ============================================================================
// GET /api/admin/users/:id
// Admin can get only their own users
const getUserById = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;
    const userId = req.params.id;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required"
      });
    }

    // Fetch user (only from this admin, not deleted)
    const sql = `
      SELECT id, username, email, phone, user_status, account_created_at, updated_at
      FROM ${TABLES.REGISTER}
      WHERE id = ? AND admin_id = ? AND deleted_at IS NULL
    `;

    const [rows] = await queryDatabase(sql, [userId, adminId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "User retrieved successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving user"
    });
  }
};

// ============================================================================
// 4. UPDATE USER (Admin)
// ============================================================================
// PUT /api/admin/users/:id
// Admin can update only their own users
const updateUser = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;
    const userId = req.params.id;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required"
      });
    }

    const { username, email, phone, status } = req.body;

    // At least one field must be provided
    if (!username && !email && !phone && !status) {
      return res.status(400).json({
        status: "error",
        message: "At least one field is required"
      });
    }

    // Fetch existing user
    const selectSql = `
      SELECT id, username, email FROM ${TABLES.REGISTER}
      WHERE id = ? AND admin_id = ? AND deleted_at IS NULL
    `;
    const [existingRows] = await queryDatabase(selectSql, [userId, adminId]);

    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const existingUser = existingRows[0];

    // Validate username uniqueness (if provided and changed)
    if (username && username !== existingUser.username) {
      const usernameCheckSql = `SELECT id FROM ${TABLES.REGISTER} WHERE username = ? AND id != ? AND deleted_at IS NULL`;
      const [usernameRows] = await queryDatabase(usernameCheckSql, [username, userId]);
      if (usernameRows && usernameRows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "Username already exists"
        });
      }
    }

    // Validate email uniqueness (if provided and changed)
    if (email && email !== existingUser.email) {
      const emailCheckSql = `SELECT id FROM ${TABLES.REGISTER} WHERE email = ? AND id != ? AND deleted_at IS NULL`;
      const [emailRows] = await queryDatabase(emailCheckSql, [email, userId]);
      if (emailRows && emailRows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "Email already exists"
        });
      }
    }

    // Build update query dynamically
    let updateClause = "SET ";
    let updateParams = [];
    let updates = [];

    if (username) {
      updates.push("username = ?");
      updateParams.push(username);
    }
    if (email) {
      updates.push("email = ?");
      updateParams.push(email);
    }
    if (phone) {
      updates.push("phone = ?");
      updateParams.push(phone);
    }
    if (status) {
      updates.push("user_status = ?");
      updateParams.push(status);
    }

    // Always update updated_at
    updates.push("updated_at = NOW()");

    updateClause += updates.join(", ");
    updateClause += " WHERE id = ? AND admin_id = ?";

    updateParams.push(userId, adminId);

    // Update user
    const updateSql = `UPDATE ${TABLES.REGISTER} ${updateClause}`;
    await queryDatabase(updateSql, updateParams);

    return res.status(200).json({
      status: "success",
      message: "User updated successfully"
    });

  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error updating user"
    });
  }
};

// ============================================================================
// 5. PATCH USER STATUS (Admin)
// ============================================================================
// PATCH /api/admin/users/:id/status
// Admin can toggle user status (active/inactive)
const patchUserStatus = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;
    const userId = req.params.id;
    const { status } = req.body;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required"
      });
    }

    if (!status) {
      return res.status(400).json({
        status: "error",
        message: "Status is required"
      });
    }

    // Validate status value
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Status must be 'active' or 'inactive'"
      });
    }

    // Fetch existing user
    const selectSql = `SELECT token_version FROM ${TABLES.REGISTER} WHERE id = ? AND admin_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [userId, adminId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    // If toggling to inactive, increment token_version to force logout
    let newTokenVersion = rows[0].token_version || 1;
    if (status === "inactive") {
      newTokenVersion = newTokenVersion + 1;
    }

    // Update status
    const updateSql = `
      UPDATE ${TABLES.REGISTER}
      SET user_status = ?, token_version = ?, updated_at = NOW()
      WHERE id = ? AND admin_id = ?
    `;

    await queryDatabase(updateSql, [status, newTokenVersion, userId, adminId]);

    return res.status(200).json({
      status: "success",
      message: `User status changed to ${status}`,
      data: { status }
    });

  } catch (error) {
    console.error("Patch user status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error updating user status"
    });
  }
};

// ============================================================================
// 6. RESET USER PASSWORD (Admin)
// ============================================================================
// POST /api/admin/users/:id/reset-password
// Admin can reset user password and force logout
const resetUserPassword = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;
    const userId = req.params.id;
    const { password } = req.body;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        status: "error",
        message: "New password is required"
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long"
      });
    }

    // Fetch existing user to verify it exists
    const selectSql = `SELECT token_version FROM ${TABLES.REGISTER} WHERE id = ? AND admin_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [userId, adminId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS || 12);

    // Increment token_version to force logout
    const newTokenVersion = (rows[0].token_version || 1) + 1;

    // Update password, token_version, and updated_at
    const updateSql = `
      UPDATE ${TABLES.REGISTER}
      SET password = ?, token_version = ?, updated_at = NOW()
      WHERE id = ? AND admin_id = ?
    `;

    await queryDatabase(updateSql, [hashedPassword, newTokenVersion, userId, adminId]);

    return res.status(200).json({
      status: "success",
      message: "User password reset successfully. User will be forced to logout."
    });

  } catch (error) {
    console.error("Reset user password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error resetting user password"
    });
  }
};

// ============================================================================
// 7. DELETE USER (Admin) - Soft Delete
// ============================================================================
// DELETE /api/admin/users/:id
// Admin can soft delete only their own users
const deleteUser = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const role = req.user?.role;
    const userId = req.params.id;

    // Verify admin role
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin role required."
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required"
      });
    }

    // Fetch existing user to verify it exists and belongs to this admin
    const selectSql = `SELECT token_version FROM ${TABLES.REGISTER} WHERE id = ? AND admin_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [userId, adminId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    // Soft delete: set status to inactive, set deleted_at, increment token_version
    const newTokenVersion = (rows[0].token_version || 1) + 1;

    const deleteSql = `
      UPDATE ${TABLES.REGISTER}
      SET user_status = ?, deleted_at = NOW(), token_version = ?, updated_at = NOW()
      WHERE id = ? AND admin_id = ?
    `;

    await queryDatabase(deleteSql, ["inactive", newTokenVersion, userId, adminId]);

    return res.status(200).json({
      status: "success",
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error deleting user"
    });
  }
};

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  patchUserStatus,
  resetUserPassword,
  deleteUser
};

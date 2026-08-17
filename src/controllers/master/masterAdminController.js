const { queryDatabase } = require("../../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { TABLES } = require("../../config/tables");
const { BCRYPT_SALT_ROUNDS } = require("../../config/constants");
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require("../../utils/errors");

// ============================================================================
// PASSWORD VALIDATION - TASK 2: Strong password validation for Master/Admin
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
// MASTER ADMIN LOGIN
// ============================================================================
// POST /api/master/login
// Validate email, password, status == active
// Generate JWT with master role
// TASK 7: Use configurable JWT expiry for master
const masterLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required"
      });
    }

    // Query master_admin table
    const sql = `SELECT id, email, password, status, token_version, created_at, updated_at FROM master_admin WHERE email = ?`;
    const [rows] = await queryDatabase(sql, [email]);

    // Check if master admin exists
    if (!rows || rows.length === 0) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password"
      });
    }

    const master = rows[0];

    // Check if status is active
    if (master.status !== "active") {
      return res.status(403).json({
        status: "error",
        message: "Your account has been deactivated. Please contact support."
      });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, master.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password"
      });
    }

    // TASK 7: Use configurable JWT expiry for master (default 12h)
    const masterJwtExpire = process.env.MASTER_JWT_EXPIRE || "12h";

    // Generate JWT token with master role
    // TASK 8: Include tokenVersion for forced logout support
    const token = jwt.sign(
      {
        id: master.id,
        role: "master",
        master_id: master.id,
        email: master.email,
        tokenVersion: master.token_version || 1
      },
      process.env.JWT_SECRET,
      { expiresIn: masterJwtExpire }
    );

    // TASK 10: Standardize response format - Return consistent success response
    return res.status(200).json({
      status: "success",
      message: "Master admin login successful",
      token,
      master: {
        id: master.id,
        email: master.email,
        status: master.status,
        created_at: master.created_at,
        updated_at: master.updated_at
      }
    });

  } catch (error) {
    // TASK 3: Remove sensitive logging - never log JWTs, passwords, or email
    if (process.env.NODE_ENV === "development") {
      console.error("Master login error (development only):", error.message);
    }
    return res.status(500).json({
      status: "error",
      message: "Server error during login"
    });
  }
};

// ============================================================================
// MASTER ADMIN PROFILE
// ============================================================================
// GET /api/master/profile
// Return master profile information
const getMasterProfile = async (req, res) => {
  try {
    const masterId = req.user?.id;
    const role = req.user?.role;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!masterId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No master ID found in token."
      });
    }

    const sql = `SELECT id, email, status, created_at, updated_at FROM master_admin WHERE id = ?`;
    const [rows] = await queryDatabase(sql, [masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Master admin not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Master profile retrieved successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("Get master profile error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving profile"
    });
  }
};

// ============================================================================
// CHANGE PASSWORD
// ============================================================================
// PUT /api/master/change-password
// Validate old password, hash new password, increment token_version
// TASK 2: Apply strong password validation
// TASK 8: Verify token_version increments for forced logout
const changePassword = async (req, res) => {
  try {
    const masterId = req.user?.id;
    const role = req.user?.role;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    // Validate input
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "Old password, new password, and confirm password are required"
      });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "New password and confirm password do not match"
      });
    }

    // TASK 2: Apply strong password validation (8+ chars, uppercase, lowercase, number, special char)
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        status: "error",
        message: passwordError
      });
    }

    // Fetch current master admin
    const sql = `SELECT id, password, token_version FROM master_admin WHERE id = ?`;
    const [rows] = await queryDatabase(sql, [masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Master admin not found"
      });
    }

    const master = rows[0];

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, master.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Old password is incorrect"
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS || 12);

    // Increment token_version for forced logout
    // TASK 8: This ensures all existing sessions are invalidated
    const newTokenVersion = (master.token_version || 1) + 1;

    // Update password and token_version
    const updateSql = `
      UPDATE master_admin 
      SET password = ?, token_version = ?, updated_at = NOW() 
      WHERE id = ?
    `;
    await queryDatabase(updateSql, [hashedNewPassword, newTokenVersion, masterId]);

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully. Please login again with your new password."
    });

  } catch (error) {
    // TASK 3: Remove sensitive logging - never log passwords or errors
    if (process.env.NODE_ENV === "development") {
      console.error("Change password error (development only):", error.message);
    }
    return res.status(500).json({
      status: "error",
      message: "Server error changing password"
    });
  }
};

// ============================================================================
// LOGOUT
// ============================================================================
// POST /api/master/logout
// Increment token_version to invalidate all sessions
// TASK 8: Verify token_version increments for forced logout
const logout = async (req, res) => {
  try {
    const masterId = req.user?.id;
    const role = req.user?.role;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!masterId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No master ID found in token."
      });
    }

    // Fetch current token_version
    const selectSql = `SELECT token_version FROM master_admin WHERE id = ?`;
    const [rows] = await queryDatabase(selectSql, [masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Master admin not found"
      });
    }

    // Increment token_version to invalidate all sessions
    // TASK 8: This ensures logout works and all tokens are rejected
    const newTokenVersion = (rows[0].token_version || 1) + 1;

    // Update token_version
    const updateSql = `UPDATE master_admin SET token_version = ? WHERE id = ?`;
    await queryDatabase(updateSql, [newTokenVersion, masterId]);

    return res.status(200).json({
      status: "success",
      message: "Logout successful"
    });

  } catch (error) {
    // TASK 3: Remove sensitive logging
    if (process.env.NODE_ENV === "development") {
      console.error("Logout error (development only):", error.message);
    }
    return res.status(500).json({
      status: "error",
      message: "Server error during logout"
    });
  }
};

module.exports = {
  masterLogin,
  getMasterProfile,
  changePassword,
  logout
};

const { queryDatabase } = require("../../config/db");
const bcrypt = require("bcrypt");
const { TABLES } = require("../../config/tables");
const { BCRYPT_SALT_ROUNDS } = require("../../config/constants");
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require("../../utils/errors");

// ============================================================================
// PASSWORD VALIDATION - TASK 2: Reusable validation for Admin/Master passwords
// ============================================================================
// Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
// This ensures Admin/Master passwords match User password complexity
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
// 1. CREATE ADMIN
// ============================================================================
// POST /api/master/admins
// Master only - Create new admin under this master
// TASK 2: Apply strong password validation to admin creation
const createAdmin = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;

    // ============================================================
    // 1. Verify master role
    // ============================================================
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required.",
      });
    }

    // ============================================================
    // 2. Get request data
    // ============================================================
    const {
      admin_name,
      company_name,
      email_id,
      password,
      phone,
      admin_domain,
      permission,
      status,
      primary_color,
      secondary_color,
    } = req.body;

    // ============================================================
    // 3. Validate required fields
    // ============================================================
    if (
      !admin_name ||
      !email_id ||
      !password ||
      !phone ||
      !admin_domain
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "admin_name, email_id, password, phone, and admin_domain are required",
      });
    }

    // ============================================================
    // 4. Validate password
    // ============================================================
    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        status: "error",
        message: passwordError,
      });
    }

    // ============================================================
    // 5. Validate admin name uniqueness
    // ============================================================
    const adminNameCheckSql = `
      SELECT id
      FROM ${TABLES.ADMINS}
      WHERE admin_name = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [adminNameRows] = await queryDatabase(adminNameCheckSql, [
      admin_name.trim(),
    ]);

    if (adminNameRows && adminNameRows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Admin name already exists",
      });
    }

    // ============================================================
    // 6. Validate email uniqueness
    // ============================================================
    const emailCheckSql = `
      SELECT id
      FROM ${TABLES.ADMINS}
      WHERE email_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [emailRows] = await queryDatabase(emailCheckSql, [
      email_id.trim().toLowerCase(),
    ]);

    if (emailRows && emailRows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Email already exists",
      });
    }

    // ============================================================
    // 7. Validate domain uniqueness
    // ============================================================
    const domainCheckSql = `
      SELECT id
      FROM ${TABLES.ADMINS}
      WHERE admin_domain = ?
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const [domainRows] = await queryDatabase(domainCheckSql, [
      admin_domain.trim(),
    ]);

    if (domainRows && domainRows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Domain already exists",
      });
    }

    // ============================================================
    // 8. Handle permission
    // ============================================================
    const permissionString = Array.isArray(permission)
      ? permission.join(",")
      : permission || "";

    // ============================================================
    // 9. Handle status
    // ============================================================
    const adminStatus = status || "active";

    const allowedStatuses = [
      "active",
      "inactive",
      "pending",
      "suspended",
    ];

    if (!allowedStatuses.includes(adminStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status",
      });
    }

    // ============================================================
    // 10. Handle colors
    // ============================================================
    const primaryColor = primary_color || "#1877F2";
    const secondaryColor = secondary_color || "#0F172A";

    // Basic HEX color validation
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    if (!hexColorRegex.test(primaryColor)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid primary color",
      });
    }

    if (!hexColorRegex.test(secondaryColor)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid secondary color",
      });
    }

    // ============================================================
    // 11. Handle logo
    // ============================================================
    let logoPath = null;

    if (req.file) {
      logoPath = `/uploads/logos/${req.file.filename}`;
    }

    // ============================================================
    // 12. Hash password
    // ============================================================
    const hashedPassword = await bcrypt.hash(
      password,
      BCRYPT_SALT_ROUNDS || 12
    );

    // ============================================================
    // 13. Insert admin
    // ============================================================
    const insertSql = `
      INSERT INTO ${TABLES.ADMINS}
      (
        master_id,
        admin_name,
        email_id,
        phone,
        password,
        role,
        permission,
        status,
        company_name,
        admin_domain,
        logo,
        primary_color,
        secondary_color,
        token_version,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await queryDatabase(insertSql, [
      masterId,
      admin_name.trim(),
      email_id.trim().toLowerCase(),
      phone.trim(),
      hashedPassword,
      "admin",
      permissionString,
      adminStatus,
      company_name?.trim() || null,
      admin_domain.trim(),
      logoPath,
      primaryColor,
      secondaryColor,
      1,
    ]);

    // ============================================================
    // 14. Success response
    // ============================================================
    return res.status(201).json({
      status: "success",
      message: "Admin created successfully",
      data: {
        id: result?.insertId,
        admin_name: admin_name.trim(),
        company_name: company_name?.trim() || null,
        email_id: email_id.trim().toLowerCase(),
        phone: phone.trim(),
        domain: admin_domain.trim(),
        permission: permissionString,
        status: adminStatus,
        logo: logoPath,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Create admin error (development only):",
        error.message
      );
    }

    return res.status(500).json({
      status: "error",
      message: "Server error creating admin",
    });
  }
};

// ============================================================================
// 2. LIST ALL ADMINS
// ============================================================================
// GET /api/master/admins
// Master only - List all admins with pagination, search, sort, status filter
const listAllAdmins = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Search parameter
    const search = req.query.search || "";

    // Sort parameter (default by created_at DESC)
    const sortBy = req.query.sortBy || "created_at";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

    // Filter by status
    const status = req.query.status || null;

    // Build WHERE clause
    let whereClause = `WHERE master_id = ? AND deleted_at IS NULL`;
    let params = [masterId];

    // Add search filter
    if (search) {
      whereClause += ` AND (admin_name LIKE ? OR email_id LIKE ? OR domain LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Add status filter
    if (status) {
      whereClause += ` AND status = ?`;
      params.push(status);
    }

    // Count total records
    const countSql = `SELECT COUNT(*) as total FROM ${TABLES.ADMINS} ${whereClause}`;
    const [countResult] = await queryDatabase(countSql, params);
    const total = countResult[0]?.total || 0;

    // Fetch paginated data
    const dataParams = [...params];
    const fetchSql = `
      SELECT id, admin_name, company_name, email_id, phone, admin_domain, permission, status, created_at, updated_at
      FROM ${TABLES.ADMINS}
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    dataParams.push(limit, offset);

    const [admins] = await queryDatabase(fetchSql, dataParams);

    return res.status(200).json({
      status: "success",
      message: "Admins retrieved successfully",
      data: {
        admins: admins || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("List admins error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving admins"
    });
  }
};

// ============================================================================
// 3. GET ADMIN BY ID
// ============================================================================
// GET /api/master/admins/:id
// Master only - Return one admin details
const getAdminById = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;
    const adminId = req.params.id;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID is required"
      });
    }

    // Fetch admin (only from this master, not deleted)
    const sql = `
      SELECT id, admin_name, email_id, phone, admin_domain, permission, status, created_at, updated_at
      FROM ${TABLES.ADMINS}
      WHERE id = ? AND master_id = ? AND deleted_at IS NULL
    `;

    const [rows] = await queryDatabase(sql, [adminId, masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Admin retrieved successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("Get admin by ID error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving admin"
    });
  }
};

// ============================================================================
// 4. UPDATE ADMIN
// ============================================================================
// PUT /api/master/admins/:id
// Master only - Update admin (admin_name, email_id, phone, domain, permission, status)
const updateAdmin = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;
    const adminId = req.params.id;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID is required"
      });
    }

    const { admin_name, email_id, phone, domain, permission, status } = req.body;

    // At least one field must be provided
    if (!admin_name && !email_id && !phone && !domain && !permission && !status) {
      return res.status(400).json({
        status: "error",
        message: "At least one field is required"
      });
    }

    // Fetch existing admin
    const selectSql = `
      SELECT id, admin_name, email_id, admin_domain FROM ${TABLES.ADMINS}
      WHERE id = ? AND master_id = ? AND deleted_at IS NULL
    `;
    const [existingRows] = await queryDatabase(selectSql, [adminId, masterId]);

    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found"
      });
    }

    const existingAdmin = existingRows[0];

    // Validate admin_name uniqueness (if provided and changed)
    if (admin_name && admin_name !== existingAdmin.admin_name) {
      const adminNameCheckSql = `SELECT id FROM ${TABLES.ADMINS} WHERE admin_name = ? AND id != ? AND deleted_at IS NULL`;
      const [adminNameRows] = await queryDatabase(adminNameCheckSql, [admin_name, adminId]);
      if (adminNameRows && adminNameRows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "Admin name already exists"
        });
      }
    }

    // Validate email_id uniqueness (if provided and changed)
    if (email_id && email_id !== existingAdmin.email_id) {
      const emailCheckSql = `SELECT id FROM ${TABLES.ADMINS} WHERE email_id = ? AND id != ? AND deleted_at IS NULL`;
      const [emailRows] = await queryDatabase(emailCheckSql, [email_id, adminId]);
      if (emailRows && emailRows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "Email already exists"
        });
      }
    }

    // Validate domain uniqueness (if provided and changed)
    if (domain && domain !== existingAdmin.domain) {
      const domainCheckSql = `SELECT id FROM ${TABLES.ADMINS} WHERE domain = ? AND id != ? AND deleted_at IS NULL`;
      const [domainRows] = await queryDatabase(domainCheckSql, [domain, adminId]);
      if (domainRows && domainRows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "Domain already exists"
        });
      }
    }

    // Build update query dynamically
    let updateClause = "SET ";
    let updateParams = [];
    let updates = [];

    if (admin_name) {
      updates.push("admin_name = ?");
      updateParams.push(admin_name);
    }
    if (email_id) {
      updates.push("email_id = ?");
      updateParams.push(email_id);
    }
    if (phone) {
      updates.push("phone = ?");
      updateParams.push(phone);
    }
    if (domain) {
      updates.push("admin_domain = ?");
      updateParams.push(domain);
    }
    if (permission) {
      const permissionString = Array.isArray(permission)
        ? permission.join(",")
        : permission;
      updates.push("permission = ?");
      updateParams.push(permissionString);
    }
    if (status) {
      updates.push("status = ?");
      updateParams.push(status);
    }

    // Always update updated_at
    updates.push("updated_at = NOW()");

    updateClause += updates.join(", ");
    updateClause += " WHERE id = ? AND master_id = ?";

    updateParams.push(adminId, masterId);

    // Update admin
    const updateSql = `UPDATE ${TABLES.ADMINS} ${updateClause}`;
    await queryDatabase(updateSql, updateParams);

    return res.status(200).json({
      status: "success",
      message: "Admin updated successfully"
    });

  } catch (error) {
    console.error("Update admin error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error updating admin"
    });
  }
};

// ============================================================================
// 5. PATCH ADMIN STATUS
// ============================================================================
// PATCH /api/master/admins/:id/status
// Master only - Toggle status between active/inactive
const patchAdminStatus = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;
    const adminId = req.params.id;
    const { status } = req.body;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID is required"
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

    // Fetch existing admin
    const selectSql = `SELECT token_version FROM ${TABLES.ADMINS} WHERE id = ? AND master_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [adminId, masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found"
      });
    }

    // If toggling to inactive, increment token_version to force logout
    let newTokenVersion = rows[0].token_version || 1;
    if (status === "inactive") {
      newTokenVersion = newTokenVersion + 1;
    }

    // Update status
    const updateSql = `
      UPDATE ${TABLES.ADMINS}
      SET status = ?, token_version = ?, updated_at = NOW()
      WHERE id = ? AND master_id = ?
    `;

    await queryDatabase(updateSql, [status, newTokenVersion, adminId, masterId]);

    return res.status(200).json({
      status: "success",
      message: `Admin status changed to ${status}`,
      data: { status }
    });

  } catch (error) {
    console.error("Patch admin status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error updating admin status"
    });
  }
};

// ============================================================================
// 6. RESET ADMIN PASSWORD
// ============================================================================
// POST /api/master/admins/:id/reset-password
// Master only - Reset admin password and force logout
// TASK 2: Apply strong password validation
const resetAdminPassword = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;
    const adminId = req.params.id;
    const { password } = req.body;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        status: "error",
        message: "New password is required"
      });
    }

    // TASK 2: Apply strong password validation (8+ chars, uppercase, lowercase, number, special char)
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        status: "error",
        message: passwordError
      });
    }

    // Fetch existing admin to verify it exists
    const selectSql = `SELECT token_version FROM ${TABLES.ADMINS} WHERE id = ? AND master_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [adminId, masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found"
      });
    }

    // Hash new password with bcrypt
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS || 12);

    // Increment token_version to force logout
    // TASK 8: Verify forced logout still works - token_version is incremented
    const newTokenVersion = (rows[0].token_version || 1) + 1;

    // Update password, token_version, and updated_at
    const updateSql = `
      UPDATE ${TABLES.ADMINS}
      SET password = ?, token_version = ?, updated_at = NOW()
      WHERE id = ? AND master_id = ?
    `;

    await queryDatabase(updateSql, [hashedPassword, newTokenVersion, adminId, masterId]);

    return res.status(200).json({
      status: "success",
      message: "Admin password reset successfully. Admin will be forced to logout."
    });

  } catch (error) {
    // TASK 3: Remove sensitive logging
    if (process.env.NODE_ENV === "development") {
      console.error("Reset admin password error (development only):", error.message);
    }
    return res.status(500).json({
      status: "error",
      message: "Server error resetting admin password"
    });
  }
};

// ============================================================================
// 7. DELETE ADMIN (Soft Delete)
// ============================================================================
// DELETE /api/master/admins/:id
// Master only - Soft delete (set status=inactive, deleted_at=NOW())
const deleteAdmin = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const role = req.user?.role;
    const adminId = req.params.id;

    // Verify master role
    if (role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID is required"
      });
    }

    // Fetch existing admin to verify it exists and belongs to this master
    const selectSql = `SELECT token_version FROM ${TABLES.ADMINS} WHERE id = ? AND master_id = ? AND deleted_at IS NULL`;
    const [rows] = await queryDatabase(selectSql, [adminId, masterId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found"
      });
    }

    // Soft delete: set status to inactive, set deleted_at, increment token_version
    const newTokenVersion = (rows[0].token_version || 1) + 1;

    const deleteSql = `
      UPDATE ${TABLES.ADMINS}
      SET status = ?, deleted_at = NOW(), token_version = ?, updated_at = NOW()
      WHERE id = ? AND master_id = ?
    `;

    await queryDatabase(deleteSql, ["inactive", newTokenVersion, adminId, masterId]);

    return res.status(200).json({
      status: "success",
      message: "Admin deleted successfully"
    });

  } catch (error) {
    console.error("Delete admin error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error deleting admin"
    });
  }
};

module.exports = {
  validatePassword,
  createAdmin,
  listAllAdmins,
  getAdminById,
  updateAdmin,
  patchAdminStatus,
  resetAdminPassword,
  deleteAdmin
};

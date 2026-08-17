const bcrypt = require("bcrypt");
const { queryDatabase } = require("../../config/db");

/**
 * User submits an account deletion request
 * POST /api/account-delete-request
 */
// const createAccountDeleteRequest = async (req, res) => {
//   try {
//     const { email, name, contact_number, password, reason } = req.body;

//     const cleanEmail = email?.trim().toLowerCase();
//     const cleanName = name?.trim();
//     const cleanContactNumber = contact_number?.trim();
//     const cleanPassword = password?.trim();
//     const cleanReason = reason?.trim();

//     if (
//       !cleanEmail ||
//       !cleanName ||
//       !cleanContactNumber ||
//       !cleanPassword ||
//       !cleanReason
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Email, name, contact number, password and reason are required.",
//       });
//     }

//     const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//     if (!emailPattern.test(cleanEmail)) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter a valid email address.",
//       });
//     }

//     const contactDigits = cleanContactNumber.replace(/\D/g, "");

//     if (contactDigits.length < 7 || contactDigits.length > 15) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter a valid contact number.",
//       });
//     }

//     if (cleanReason.length < 10) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Please enter a clear reason with at least 10 characters.",
//       });
//     }

//     if (cleanReason.length > 500) {
//       return res.status(400).json({
//         success: false,
//         message: "Reason cannot exceed 500 characters.",
//       });
//     }

//     // Prevent multiple pending requests from the same email
//     const [existingRequests] = await queryDatabase(
//       `
//         SELECT id
//         FROM account_delete_requests
//         WHERE email = ?
//           AND status = 'pending'
//         LIMIT 1
//       `,
//       [cleanEmail]
//     );

//     if (existingRequests.length > 0) {
//       return res.status(409).json({
//         success: false,
//         message:
//           "An account deletion request is already pending for this email.",
//       });
//     }

//     /*
//       Optional: find the user from your users table.

//       Change "users" if your actual table name is different.
//       Change "email" if your email column name is different.
//     */
//     const [users] = await queryDatabase(
//       `
//         SELECT id, username, email
//         FROM users
//         WHERE LOWER(email) = ?
//         LIMIT 1
//       `,
//       [cleanEmail]
//     );

//     const userId = users.length > 0 ? users[0].id : null;

//     const [insertResult] = await queryDatabase(
//       `
//         INSERT INTO account_delete_requests
//         (
//           user_id,
//           email,
//           name,
//           contact_number,
//           reason,
//           status
//         )
//         VALUES (?, ?, ?, ?, ?, 'pending')
//       `,
//       [
//         userId,
//         cleanEmail,
//         cleanName,
//         cleanContactNumber,
//         cleanReason,
//       ]
//     );

//     return res.status(201).json({
//       success: true,
//       message:
//         "Your account deletion request has been submitted successfully.",
//       data: {
//         id: insertResult.insertId,
//         user_id: userId,
//         email: cleanEmail,
//         name: cleanName,
//         contact_number: cleanContactNumber,
//         reason: cleanReason,
//         status: "pending",
//       },
//     });
//   } catch (error) {
//     console.error("createAccountDeleteRequest error:", error);

//     return res.status(500).json({
//       success: false,
//       message:
//         "Server error while submitting the account deletion request.",
//     });
//   }
// };

const createAccountDeleteRequest = async (req, res) => {
  try {
    const {
      email,
      name,
      contact_number,
      password,
      reason,
    } = req.body;

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    const cleanName = String(name || "")
      .trim()
      .replace(/\s+/g, " ");

    const cleanContactNumber = String(contact_number || "").trim();
    const cleanReason = String(reason || "").trim();

    // Required field validation
    if (
      !cleanEmail ||
      !cleanName ||
      !cleanContactNumber ||
      !password ||
      !cleanReason
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email, name, contact number, password and reason are required.",
      });
    }

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // Contact validation
    const contactDigits = cleanContactNumber.replace(/\D/g, "");

    if (contactDigits.length < 7 || contactDigits.length > 15) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid contact number.",
      });
    }

    // Reason validation
    if (cleanReason.length < 10) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a reason containing at least 10 characters.",
      });
    }

    if (cleanReason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Reason cannot exceed 500 characters.",
      });
    }

    // Find user from the same users table used by login
    const [users] = await queryDatabase(
      `
        SELECT
          id,
          username,
          email,
          whatsapp_number,
          password
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
      `,
      [cleanEmail]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No account was found with this email address.",
      });
    }

    const user = users[0];

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password is not configured for this account.",
      });
    }

    // Verify password without storing or returning it
    const storedPassword = String(user.password);
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    let isPasswordCorrect = false;

    if (isBcryptHash) {
      isPasswordCorrect = await bcrypt.compare(
        String(password),
        storedPassword
      );
    } else {
      /*
       * Temporary compatibility for old plaintext passwords.
       * Once matched, immediately convert the old password to bcrypt.
       */
      isPasswordCorrect = String(password) === storedPassword;

      if (isPasswordCorrect) {
        const hashedPassword = await bcrypt.hash(String(password), 10);

        await queryDatabase(
          `
            UPDATE users
            SET password = ?
            WHERE id = ?
          `,
          [hashedPassword, user.id]
        );
      }
    }

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Incorrect account password.",
      });
    }

    // Validate entered name against account name
    const databaseName = String(user.username || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (
      databaseName &&
      cleanName.toLowerCase() !== databaseName
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The entered name does not match the registered account name.",
      });
    }

    // Validate entered contact number
    const databaseContactDigits = String(
      user.whatsapp_number || ""
    ).replace(/\D/g, "");

    if (
      databaseContactDigits &&
      contactDigits !== databaseContactDigits
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The entered contact number does not match the registered number.",
      });
    }

    // Prevent duplicate pending requests
    const [existingRequests] = await queryDatabase(
      `
        SELECT id
        FROM account_delete_requests
        WHERE user_id = ?
          AND status = 'pending'
        LIMIT 1
      `,
      [user.id]
    );

    if (existingRequests.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "An account deletion request is already pending for this account.",
      });
    }

    // Save request without saving the password
    const [insertResult] = await queryDatabase(
      `
        INSERT INTO account_delete_requests
        (
          user_id,
          email,
          name,
          contact_number,
          reason,
          password_verified,
          status
        )
        VALUES (?, ?, ?, ?, ?, 1, 'pending')
      `,
      [
        user.id,
        cleanEmail,
        cleanName,
        cleanContactNumber,
        cleanReason,
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        "Your account deletion request has been submitted successfully.",
      data: {
        id: insertResult.insertId,
        user_id: user.id,
        email: cleanEmail,
        name: cleanName,
        contact_number: cleanContactNumber,
        reason: cleanReason,
        password_verified: true,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("createAccountDeleteRequest error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while submitting the account deletion request.",
    });
  }
};


/**
 * Admin gets all deletion requests
 * GET /api/admin/account-delete-requests
 */
const getAccountDeleteRequests = async (req, res) => {
  try {
    const { status, search } = req.query;

    const allowedStatuses = [
      "pending",
      "approved",
      "rejected",
    ];

    let sql = `
      SELECT
        id,
        user_id,
        email,
        name,
        contact_number,
        reason,
        status,
        admin_note,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      FROM account_delete_requests
      WHERE 1 = 1
    `;

    const values = [];

    if (status && status !== "all") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request status.",
        });
      }

      sql += " AND status = ?";
      values.push(status);
    }

    if (search?.trim()) {
      const searchValue = `%${search.trim()}%`;

      sql += `
        AND (
          name LIKE ?
          OR email LIKE ?
          OR contact_number LIKE ?
        )
      `;

      values.push(
        searchValue,
        searchValue,
        searchValue
      );
    }

    sql += `
      ORDER BY
        CASE
          WHEN status = 'pending' THEN 1
          WHEN status = 'approved' THEN 2
          WHEN status = 'rejected' THEN 3
        END,
        created_at DESC
    `;

    const [requests] = await queryDatabase(sql, values);

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getAccountDeleteRequests error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching account deletion requests.",
    });
  }
};

/**
 * Admin gets one deletion request
 * GET /api/admin/account-delete-requests/:id
 */
const getAccountDeleteRequestById = async (req, res) => {
  try {
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const [requests] = await queryDatabase(
      `
        SELECT
          id,
          user_id,
          email,
          name,
          contact_number,
          reason,
          status,
          admin_note,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        FROM account_delete_requests
        WHERE id = ?
        LIMIT 1
      `,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account deletion request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: requests[0],
    });
  } catch (error) {
    console.error("getAccountDeleteRequestById error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching the deletion request.",
    });
  }
};

/**
 * Admin approves or rejects a deletion request
 * PATCH /api/admin/account-delete-requests/:id
 */
const updateAccountDeleteRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { status, admin_note } = req.body;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be either approved or rejected.",
      });
    }

    const cleanAdminNote = admin_note?.trim() || null;

    if (status === "rejected" && !cleanAdminNote) {
      return res.status(400).json({
        success: false,
        message:
          "Admin note is required when rejecting a request.",
      });
    }

    if (cleanAdminNote && cleanAdminNote.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Admin note cannot exceed 500 characters.",
      });
    }

    const [existingRequests] = await queryDatabase(
      `
        SELECT
          id,
          user_id,
          email,
          status
        FROM account_delete_requests
        WHERE id = ?
        LIMIT 1
      `,
      [requestId]
    );

    if (existingRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account deletion request not found.",
      });
    }

    const existingRequest = existingRequests[0];

    if (existingRequest.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `This request has already been ${existingRequest.status}.`,
      });
    }

    /*
      auth middleware should store the logged-in admin in req.user.

      Adjust this depending on your JWT payload:
      req.user.id
      req.user.user_id
      req.admin.id
    */
    const reviewedBy =
      req.user?.id ||
      req.user?.user_id ||
      null;

    const [updateResult] = await queryDatabase(
      `
        UPDATE account_delete_requests
        SET
          status = ?,
          admin_note = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
        WHERE id = ?
          AND status = 'pending'
      `,
      [
        status,
        cleanAdminNote,
        reviewedBy,
        requestId,
      ]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message:
          "The request could not be updated. It may have already been reviewed.",
      });
    }

    /*
      Optional behavior:

      When an admin approves the request, deactivate the user.
      Replace user_status and users with your actual column/table names.

      This is safer than immediately deleting the complete user row.
    */
    if (
      status === "approved" &&
      existingRequest.user_id
    ) {
      await queryDatabase(
        `
          UPDATE users
          SET user_status = 'inactive'
          WHERE id = ?
        `,
        [existingRequest.user_id]
      );
    }

    const [updatedRequests] = await queryDatabase(
      `
        SELECT
          id,
          user_id,
          email,
          name,
          contact_number,
          reason,
          status,
          admin_note,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        FROM account_delete_requests
        WHERE id = ?
        LIMIT 1
      `,
      [requestId]
    );

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Account deletion request approved successfully."
          : "Account deletion request rejected successfully.",
      data: updatedRequests[0],
    });
  } catch (error) {
    console.error("updateAccountDeleteRequest error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while updating the account deletion request.",
    });
  }
};

/**
 * Admin gets deletion request statistics
 * GET /api/admin/account-delete-requests/stats
 */
const getAccountDeleteRequestStats = async (req, res) => {
  try {
    const [rows] = await queryDatabase(
      `
        SELECT
          COUNT(*) AS total,
          SUM(status = 'pending') AS pending,
          SUM(status = 'approved') AS approved,
          SUM(status = 'rejected') AS rejected
        FROM account_delete_requests
      `
    );

    const stats = rows[0] || {};

    return res.status(200).json({
      success: true,
      stats: {
        total: Number(stats.total || 0),
        pending: Number(stats.pending || 0),
        approved: Number(stats.approved || 0),
        rejected: Number(stats.rejected || 0),
      },
    });
  } catch (error) {
    console.error("getAccountDeleteRequestStats error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while fetching deletion request statistics.",
    });
  }
};

module.exports = {
  createAccountDeleteRequest,
  getAccountDeleteRequests,
  getAccountDeleteRequestById,
  updateAccountDeleteRequest,
  getAccountDeleteRequestStats,
};

// ============================================================================
// RBAC MIDDLEWARE - Role-Based Access Control
// ============================================================================
// Provides role hierarchy enforcement
// Master > Admin > User
// All requiring verified JWT token (verifyToken middleware must be applied first)

const { queryDatabase } = require("../config/db");

// ============================================================================
// allowMaster
// ============================================================================
// ONLY Master admin can access
// Returns 403 Forbidden if not master role
const allowMaster = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No user in request."
      });
    }

    if (user.role !== "master") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master role required."
      });
    }

    next();
  } catch (error) {
    console.error("allowMaster middleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error in authorization"
    });
  }
};

// ============================================================================
// allowAdmin
// ============================================================================
// Master and Admin can access
// User gets 403 Forbidden
const allowAdmin = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No user in request."
      });
    }

    if (user.role !== "master" && user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Master or Admin role required."
      });
    }

    next();
  } catch (error) {
    console.error("allowAdmin middleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error in authorization"
    });
  }
};

// ============================================================================
// allowUser
// ============================================================================
// Master, Admin, and User can access
// Everyone is allowed (pass-through)
const allowUser = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No user in request."
      });
    }

    if (user.role !== "master" && user.role !== "admin" && user.role !== "user") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Invalid role."
      });
    }

    next();
  } catch (error) {
    console.error("allowUser middleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error in authorization"
    });
  }
};

// ============================================================================
// allowRoles
// ============================================================================
// Dynamic role checker - accepts one or more roles
// Usage: allowRoles("master", "admin") - allows master OR admin
// Returns 403 Forbidden if user role not in allowed list
const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized. No user in request."
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          status: "error",
          message: `Access denied. Requires one of: ${allowedRoles.join(", ")}.`
        });
      }

      next();
    } catch (error) {
      console.error("allowRoles middleware error:", error);
      return res.status(500).json({
        status: "error",
        message: "Server error in authorization"
      });
    }
  };
};

// ============================================================================
// MULTI-TENANT SECURITY MIDDLEWARE
// ============================================================================
// Enforces data isolation at middleware level
// Ensures user can only access their own data
// Master can access all data (no filtering)

const tenantMiddleware = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized. No user in request."
      });
    }

    // Attach tenant context to request
    // Controllers will use this to filter queries
    req.tenant = {
      role: user.role,
      master_id: user.master_id,
      admin_id: user.admin_id,
      user_id: user.user_id
    };

    next();
  } catch (error) {
    console.error("tenantMiddleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error in tenant isolation"
    });
  }
};

module.exports = {
  allowMaster,
  allowAdmin,
  allowUser,
  allowRoles,
  tenantMiddleware
};

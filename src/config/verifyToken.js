// const jwt = require('jsonwebtoken');

// const verifyToken = (req, res, next) => {
//     const authHeader = req.headers['authorization'];

//     if (!authHeader) {
//         return res.status(401).json({ status: 'error', message: 'No token provided' });
//     }

//     const token = authHeader.split(' ')[1]; // Remove "Bearer "
//     if (!token) {
//         return res.status(401).json({ status: 'error', message: 'Invalid token format' });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = decoded; // Store user data from token (id, email, etc.)
//         next();
//     } catch (err) {
//         return res.status(403).json({ status: 'error', message: 'Session expired, Kindly login to continue' });
//     }
// };

// module.exports = verifyToken;


const jwt = require("jsonwebtoken");
const { queryDatabase } = require("./db");

// ============================================================================
// VERIFY TOKEN MIDDLEWARE - SUPPORTS MASTER, ADMIN, AND USER ROLES
// ============================================================================
// Validates JWT token and checks token_version from database
// Supports role hierarchy: Master > Admin > User
// Rejects token if token_version doesn't match (forced logout)
// TASK 3: Removed all sensitive logging (no JWT, password, token_version, or sensitive data logging)
// TASK 8: Verify token_version continues to work for forced logout

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({
            status: "error",
            message: "No token provided",
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "Invalid token format",
        });
    }

    try {
        // Verify JWT signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Determine role and fetch token_version from appropriate table
        let tokenVersionFromDb;
        let dbQuery;

        if (decoded.role === "master") {
            // Master admin - fetch from master_admin table
            dbQuery = `SELECT token_version FROM master_admin WHERE id = ?`;
        } else if (decoded.role === "admin") {
            // Admin - fetch from admins table
            dbQuery = `SELECT token_version FROM admins WHERE id = ?`;
        } else if (decoded.role === "user") {
            // User - fetch from users table
            dbQuery = `SELECT token_version FROM users WHERE id = ?`;
        } else {
            // Unknown role
            return res.status(401).json({
                status: "error",
                message: "Invalid token role",
            });
        }

        // Query database
        const [rows] = await queryDatabase(dbQuery, [decoded.id]);

        if (!rows || rows.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "User not found",
            });
        }

        tokenVersionFromDb = rows[0].token_version;

        // Validate token_version matches
        // If JWT tokenVersion doesn't match DB tokenVersion, token has been invalidated
        // TASK 8: This ensures forced logout works (password change, status change, etc.)
        const jwtTokenVersion = decoded.tokenVersion || 1;
        const dbTokenVersion = tokenVersionFromDb || 1;

        if (jwtTokenVersion !== dbTokenVersion) {
            return res.status(401).json({
                status: "error",
                message: "Session expired, Kindly login to continue",
            });
        }

        // Token is valid - store decoded info in req.user
        // Structure req.user based on role for consistency
        req.user = {
            id: decoded.id,
            role: decoded.role,
            email: decoded.email
        };

        // Add role-specific fields
        if (decoded.role === "master") {
            req.user.master_id = decoded.master_id;
        } else if (decoded.role === "admin") {
            req.user.admin_id = decoded.admin_id;
            req.user.master_id = decoded.master_id;
        } else if (decoded.role === "user") {
            req.user.user_id = decoded.user_id;
            req.user.admin_id = decoded.admin_id;
            req.user.master_id = decoded.master_id;
            req.user.username = decoded.username;
        }

        next();
    } catch (err) {
        // TASK 3: Remove sensitive logging - only log generic error message in production
        if (process.env.NODE_ENV === "development") {
            console.error("JWT verification error (development only):", err.message);
        }
        return res.status(403).json({
            status: "error",
            message: "Session expired, Kindly login to continue",
        });
    }
};

module.exports = verifyToken;

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
const { queryDatabase } = require("./db"); // Update path if needed

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("=== verifyToken.js DEBUG ===");
        console.log("Decoded JWT:", JSON.stringify(decoded, null, 2));
        console.log("JWT tokenVersion:", decoded.tokenVersion);
        console.log("JWT tokenVersion type:", typeof decoded.tokenVersion);

        // Check latest token version from database
        const [rows] = await queryDatabase(
            "SELECT token_version FROM users WHERE id = ?",
            [decoded.id]
        );

        console.log("Database query result:", JSON.stringify(rows, null, 2));
        console.log("DB token_version:", rows?.[0]?.token_version);
        console.log("DB token_version type:", typeof rows?.[0]?.token_version);

        if (!rows || rows.length === 0) {
            console.log("❌ User not found in database");
            return res.status(401).json({
                status: "error",
                message: "User not found",
            });
        }

        // If admin has forced logout
        const jwtVersion = decoded.tokenVersion;
        const dbVersion = rows[0].token_version;
        
        console.log("Comparison: JWT tokenVersion (" + jwtVersion + ") !== DB token_version (" + dbVersion + ") ?");
        console.log("Result of comparison:", jwtVersion !== dbVersion);

        if (jwtVersion !== dbVersion) {
            console.log("❌ Token version mismatch - rejecting token");
            return res.status(401).json({
                status: "error",
                message: "Session expired, Kindly login to continue",
            });
        }

        console.log("✅ Token verification passed");
        req.user = decoded;
        next();
    } catch (err) {
        console.log("❌ JWT verification error:", err.message);
        return res.status(403).json({
            status: "error",
            message: "Session expired, Kindly login to continue",
        });
    }
};

module.exports = verifyToken;

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

        // Check latest token version from database
        const [rows] = await queryDatabase(
            "SELECT token_version FROM users WHERE id = ?",
            [decoded.id]
        );

        if (!rows || rows.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "User not found",
            });
        }

        // If admin has forced logout
        if (decoded.tokenVersion !== rows[0].token_version) {
            return res.status(401).json({
                status: "error",
                message: "Session expired, Kindly login to continue",
            });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({
            status: "error",
            message: "Session expired, Kindly login to continue",
        });
    }
};

module.exports = verifyToken;

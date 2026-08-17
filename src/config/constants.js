// ============================================================================
// APPLICATION CONSTANTS
// ============================================================================
// TASK 7: Support configurable JWT expiry via environment variables
// Examples:
//   MASTER_JWT_EXPIRE=5h
//   ADMIN_JWT_EXPIRE=8h
//   USER_JWT_EXPIRE=12h

const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 10);
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

// JWT Expiry Configuration (for reference, actual expiry set in login controllers)
// These are defaults if not provided via environment variables
const JWT_EXPIRE = {
  MASTER: process.env.MASTER_JWT_EXPIRE || "5h",
  ADMIN: process.env.ADMIN_JWT_EXPIRE || "8h",
  USER: process.env.USER_JWT_EXPIRE || "12h"
};

module.exports = {
    OTP_EXPIRE_MINUTES,
    BCRYPT_SALT_ROUNDS,
    JWT_EXPIRE
}
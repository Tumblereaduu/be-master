/**
 * Build a query to select all rows from a table and order by action_time DESC
 * @param {string}   
 * @returns {string}
 */

// const getAllActivityQuery = (tableName) => 
//     `SELECT * FROM ${tableName} ORDER BY action_time DESC`;

// module.exports = {
//    getAllActivityQuery,
// };


// const register = (tableName) => 
//     `INSERT INTO ${tableName} (ip_address, select_account, username, email, password, confirm_password,)`

// const emailOTPRegister = (tableName) =>
//     `INSERT INTO ${tableName} (email, email_otp, created_at, expires_at, status)`;

// const login = (tableName) =>
//     `SELECT * FROM ${tableName} WHERE email = ?`;



// module.exports = {
//     emailOTPRegister,
// }


// ignore above

const { TABLES } = require('./tables');

module.exports = {
    // users

    getUserByEmail: `SELECT * FROM ${TABLES.REGISTER} WHERE email = ? LIMIT 1`,

    insertEmailOtp: `INSERT INTO ${TABLES.EMAIL_OTP_REGISTER}
    (email, username, email_otp, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?)`,

    getValidOtp: `SELECT * FROM ${TABLES.EMAIL_OTP_REGISTER}
    WHERE email = ? AND email_otp = ? AND status = 0 AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1`,

    markOtpUsedById: `UPDATE ${TABLES.EMAIL_OTP_REGISTER} SET status = 1 WHERE id = ?`,

    getUsedOtpForEmail: `SELECT * FROM ${TABLES.EMAIL_OTP_REGISTER} WHERE email = ? AND status = 1 ORDER BY created_at DESC LIMIT 1`,

    insertUser: `INSERT INTO ${TABLES.REGISTER} 
    (username, email, password, confirm_password, whatsapp_number, account_created_timestamp, referred_by_id, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

    updateUserContactByEmail: `UPDATE ${TABLES.REGISTER} SET mobile_number = ?, whatsapp_number = ?,gender=? WHERE email = ?`,
    updateUserReferralByEmail: `UPDATE ${TABLES.REGISTER} SET referral_id = ? WHERE email = ?`,
}

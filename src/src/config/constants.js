const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 10);
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

module.exports = {
    OTP_EXPIRE_MINUTES,
    BCRYPT_SALT_ROUNDS
}
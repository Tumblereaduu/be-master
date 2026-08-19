module.exports = {
    port: process.env.PORT || 5000,
    // jwtSecret: process.env.JWT_SECRET || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',

    FCSAPI_API_KEY: "TEEiMh7YIqvgePT75V9xbyJohUxmh",
    FCSAPI_CURRENCY_IDS: "1,39,112,1984,1975,78,79,80,81,82,7772", // XAU/USD = 1984, add others
    FCSAPI_MAIN_URL: "wss://fcsapi.com",
    FCSAPI_BACKUP_URL: "wss://fxcoinapi.com",
      
};
const TABLES = {
    REGISTER: 'users',
    EMAIL_OTP_REGISTER: 'users_email_otp',
    USER_DEPOSIT_TRANSACTION: 'deposit_transactions',
    USER_WITHDRAWAL_TRANSACTION: 'withdrawal_transactions',
    USER_SUPPORT: "support",
    SUPPORT_MESSAGES: "support_messages",

    DEMO_FUND_HISTORY: "demo_fund_history",

    DEMO_USERS_WALLET: "demo_users_wallet",
    LIVE_USERS_WALLET: "live_users_wallet",

    DEMO_USERS_ORDERS: 'demo_users_orders',
    LIVE_USERS_ORDERS: 'live_users_orders',

    DEMO_FAVOURITES: "demo_favourites",
    LIVE_FAVOURITES: "live_favourites",

    MASTER_ADMIN: "master_admin",
    ADMINS: "admins",
    ADMIN_BANNER : "banner",
    ADMIN_SPREAD : "spread",
    ADD_FUND_HISTORY: "add_fund_history",
    PAYMENT_METHOD_ADMIN: "payment_method_admin",
    ADMIN_PANEL_RATE_SETTINGS: "admin_panel_rate_settings",
    ADMIN_CONTACT :"phone_email",
    USER_LOGIN_HISTORY : "users_login",
    ADMIN_UPDATE_WALLET : "update_wallet_history",
    ADMIN_BONUS : "ib_users_history",
    ADMIN_COMMISSION : "ib_lot_commission",
    ADMIN_IB_DEPOSIT : "ib_transfer_history",
    ADMIN_IB_AMOUNT : "ib_users_commission_history"

    // ADMIN_ACTIVITY: 'admin_activity_demo_data',
    // USER_ACTIVITY: 'user_activity_demo_data',
};

// const getSelectAllQuery = (table) => `SELECT * FROM ${table} ORDER BY action_time DESC`;

module.exports = { TABLES };

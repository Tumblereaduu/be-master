-- ============================================================================
-- MIGRATION 005: Dashboard Query Optimization Indexes
-- ============================================================================
-- Adds composite indexes for dashboard query patterns
-- Complements Phase 6 single-column indexes for optimized aggregation queries

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_master_created ON users(master_id, account_created_at);
CREATE INDEX IF NOT EXISTS idx_users_admin_created ON users(admin_id, account_created_at);
CREATE INDEX IF NOT EXISTS idx_users_master_status ON users(master_id, user_status);
CREATE INDEX IF NOT EXISTS idx_users_admin_status ON users(admin_id, user_status);

-- ============================================================================
-- ORDERS TABLE INDEXES (Live)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_live_orders_user_status ON live_users_orders(user_id, order_status);
CREATE INDEX IF NOT EXISTS idx_live_orders_master_date ON live_users_orders(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_orders_admin_date ON live_users_orders(admin_id, created_at);

-- ============================================================================
-- ORDERS TABLE INDEXES (Demo)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_demo_orders_user_status ON demo_users_orders(user_id, order_status);
CREATE INDEX IF NOT EXISTS idx_demo_orders_master_date ON demo_users_orders(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_orders_admin_date ON demo_users_orders(admin_id, created_at);

-- ============================================================================
-- WALLET TABLE INDEXES (Live)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_live_wallet_user ON live_users_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_live_wallet_master_date ON live_users_wallet(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_wallet_admin_date ON live_users_wallet(admin_id, created_at);

-- ============================================================================
-- WALLET TABLE INDEXES (Demo)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_demo_wallet_user ON demo_users_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_master_date ON demo_users_wallet(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_admin_date ON demo_users_wallet(admin_id, created_at);

-- ============================================================================
-- DEPOSIT TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_deposit_user ON deposit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_master_date ON deposit_transactions(master_id, deposit_request_at);
CREATE INDEX IF NOT EXISTS idx_deposit_admin_date ON deposit_transactions(admin_id, deposit_request_at);
CREATE INDEX IF NOT EXISTS idx_deposit_master_status ON deposit_transactions(master_id, deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_admin_status ON deposit_transactions(admin_id, deposit_status);

-- ============================================================================
-- WITHDRAWAL TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_master_date ON withdrawal_transactions(master_id, withdrawal_request_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_admin_date ON withdrawal_transactions(admin_id, withdrawal_request_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_master_status ON withdrawal_transactions(master_id, withdrawal_status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_admin_status ON withdrawal_transactions(admin_id, withdrawal_status);

-- ============================================================================
-- SUPPORT TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_support_user ON support(user_id);
CREATE INDEX IF NOT EXISTS idx_support_master_date ON support(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_admin_date ON support(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_master_status ON support(master_id, status);
CREATE INDEX IF NOT EXISTS idx_support_admin_status ON support(admin_id, status);

-- ============================================================================
-- LOGIN HISTORY TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_login_user ON users_login(user_id);
CREATE INDEX IF NOT EXISTS idx_login_master_date ON users_login(master_id, created_at);
CREATE INDEX IF NOT EXISTS idx_login_admin_date ON users_login(admin_id, created_at);

-- ============================================================================
-- VERIFICATION SCRIPT
-- ============================================================================
-- Check all indexes were created:
-- SHOW INDEXES FROM users;
-- SHOW INDEXES FROM live_users_orders;
-- SHOW INDEXES FROM demo_users_orders;
-- SHOW INDEXES FROM live_users_wallet;
-- SHOW INDEXES FROM demo_users_wallet;
-- SHOW INDEXES FROM deposit_transactions;
-- SHOW INDEXES FROM withdrawal_transactions;
-- SHOW INDEXES FROM support;
-- SHOW INDEXES FROM users_login;

-- ============================================================================
-- END OF MIGRATION 005
-- ============================================================================

-- ============================================================================
-- MIGRATION 004: Database Preparation for Multi-Tenant Dashboards (Phase 6)
-- ============================================================================
-- Adds missing columns to 9 tables for multi-tenant RBAC filtering
-- These columns enable Master/Admin/User level visibility in dashboards
--
-- WARNING: Do NOT delete, rename, or change existing columns
-- WARNING: This file extends tables only, does NOT remove data
-- WARNING: Adds NULL columns - existing rows will have NULL values for new columns

-- ============================================================================
-- TABLE 1: live_users_wallet
-- ============================================================================
-- Add multi-tenant columns for admin/master wallet filtering and soft delete

ALTER TABLE live_users_wallet 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for wallet queries
CREATE INDEX IF NOT EXISTS idx_live_wallet_user_id ON live_users_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_live_wallet_admin_id ON live_users_wallet(admin_id);
CREATE INDEX IF NOT EXISTS idx_live_wallet_master_id ON live_users_wallet(master_id);
CREATE INDEX IF NOT EXISTS idx_live_wallet_deleted ON live_users_wallet(deleted_at);
CREATE INDEX IF NOT EXISTS idx_live_wallet_admin_created ON live_users_wallet(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_wallet_master_created ON live_users_wallet(master_id, created_at);

-- ============================================================================
-- TABLE 2: demo_users_wallet
-- ============================================================================
-- Add multi-tenant columns (same as live_users_wallet)

ALTER TABLE demo_users_wallet 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for demo wallet queries
CREATE INDEX IF NOT EXISTS idx_demo_wallet_user_id ON demo_users_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_admin_id ON demo_users_wallet(admin_id);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_master_id ON demo_users_wallet(master_id);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_deleted ON demo_users_wallet(deleted_at);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_admin_created ON demo_users_wallet(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_master_created ON demo_users_wallet(master_id, created_at);

-- ============================================================================
-- TABLE 3: live_users_orders
-- ============================================================================
-- Add multi-tenant columns and timestamps for order tracking

ALTER TABLE live_users_orders 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER closed_by,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for order queries
CREATE INDEX IF NOT EXISTS idx_live_orders_user_id ON live_users_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_live_orders_admin_id ON live_users_orders(admin_id);
CREATE INDEX IF NOT EXISTS idx_live_orders_master_id ON live_users_orders(master_id);
CREATE INDEX IF NOT EXISTS idx_live_orders_status ON live_users_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_live_orders_deleted ON live_users_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_live_orders_admin_status ON live_users_orders(admin_id, order_status);
CREATE INDEX IF NOT EXISTS idx_live_orders_master_status ON live_users_orders(master_id, order_status);
CREATE INDEX IF NOT EXISTS idx_live_orders_admin_created ON live_users_orders(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_orders_master_created ON live_users_orders(master_id, created_at);

-- ============================================================================
-- TABLE 4: demo_users_orders
-- ============================================================================
-- Add multi-tenant columns and timestamps (same as live_users_orders)

ALTER TABLE demo_users_orders 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER closed_by,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for demo order queries
CREATE INDEX IF NOT EXISTS idx_demo_orders_user_id ON demo_users_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_orders_admin_id ON demo_users_orders(admin_id);
CREATE INDEX IF NOT EXISTS idx_demo_orders_master_id ON demo_users_orders(master_id);
CREATE INDEX IF NOT EXISTS idx_demo_orders_status ON demo_users_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_demo_orders_deleted ON demo_users_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_demo_orders_admin_status ON demo_users_orders(admin_id, order_status);
CREATE INDEX IF NOT EXISTS idx_demo_orders_master_status ON demo_users_orders(master_id, order_status);
CREATE INDEX IF NOT EXISTS idx_demo_orders_admin_created ON demo_users_orders(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_orders_master_created ON demo_users_orders(master_id, created_at);

-- ============================================================================
-- TABLE 5: deposit_transactions
-- ============================================================================
-- Add multi-tenant columns and audit timestamps

ALTER TABLE deposit_transactions 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER deposit_verified_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for deposit transaction queries
CREATE INDEX IF NOT EXISTS idx_deposit_user_id ON deposit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_admin_id ON deposit_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_deposit_master_id ON deposit_transactions(master_id);
CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_transactions(deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_deleted ON deposit_transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deposit_admin_status ON deposit_transactions(admin_id, deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_master_status ON deposit_transactions(master_id, deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_admin_created ON deposit_transactions(admin_id, deposit_request_at);
CREATE INDEX IF NOT EXISTS idx_deposit_master_created ON deposit_transactions(master_id, deposit_request_at);

-- ============================================================================
-- TABLE 6: withdrawal_transactions
-- ============================================================================
-- Add multi-tenant columns and audit timestamps

ALTER TABLE withdrawal_transactions 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER withdrawal_verified_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for withdrawal transaction queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_admin_id ON withdrawal_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_master_id ON withdrawal_transactions(master_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_transactions(withdrawal_status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_deleted ON withdrawal_transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_admin_status ON withdrawal_transactions(admin_id, withdrawal_status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_master_status ON withdrawal_transactions(master_id, withdrawal_status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_admin_created ON withdrawal_transactions(admin_id, withdrawal_request_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_master_created ON withdrawal_transactions(master_id, withdrawal_request_at);

-- ============================================================================
-- TABLE 7: support
-- ============================================================================
-- Add multi-tenant columns and audit timestamps for support tickets

ALTER TABLE support 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER replied_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Indexes for support ticket queries
CREATE INDEX IF NOT EXISTS idx_support_user_id ON support(user_id);
CREATE INDEX IF NOT EXISTS idx_support_admin_id ON support(admin_id);
CREATE INDEX IF NOT EXISTS idx_support_master_id ON support(master_id);
CREATE INDEX IF NOT EXISTS idx_support_status ON support(status);
CREATE INDEX IF NOT EXISTS idx_support_deleted ON support(deleted_at);
CREATE INDEX IF NOT EXISTS idx_support_admin_status ON support(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_support_master_status ON support(master_id, status);
CREATE INDEX IF NOT EXISTS idx_support_admin_created ON support(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_master_created ON support(master_id, created_at);

-- ============================================================================
-- TABLE 8: users_login (Audit Trail)
-- ============================================================================
-- Add multi-tenant columns for session tracking and audit

ALTER TABLE users_login 
  ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER created_at;

-- Indexes for login history queries
CREATE INDEX IF NOT EXISTS idx_login_user_id ON users_login(user_id);
CREATE INDEX IF NOT EXISTS idx_login_admin_id ON users_login(admin_id);
CREATE INDEX IF NOT EXISTS idx_login_master_id ON users_login(master_id);
CREATE INDEX IF NOT EXISTS idx_login_action ON users_login(action);
CREATE INDEX IF NOT EXISTS idx_login_deleted ON users_login(deleted_at);
CREATE INDEX IF NOT EXISTS idx_login_created ON users_login(created_at);
CREATE INDEX IF NOT EXISTS idx_login_admin_created ON users_login(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_login_master_created ON users_login(master_id, created_at);

-- ============================================================================
-- TABLE 9: users (Additional indexes from Phase 5)
-- ============================================================================
-- Add master_id index for master-level user reporting

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id;

-- Index for master-level user queries
CREATE INDEX IF NOT EXISTS idx_users_master_id ON users(master_id);
CREATE INDEX IF NOT EXISTS idx_users_master_status ON users(master_id, user_status);
CREATE INDEX IF NOT EXISTS idx_users_master_created ON users(master_id, account_created_at);

-- ============================================================================
-- TABLE 10: admins (Additional indexes from Phase 4)
-- ============================================================================
-- Add composite index for master admin filtering

CREATE INDEX IF NOT EXISTS idx_admins_master_status ON admins(master_id, status);

-- ============================================================================
-- VERIFICATION SCRIPT (Run after migration to verify all columns exist)
-- ============================================================================
-- Check live_users_wallet
-- SELECT admin_id, master_id, deleted_at FROM live_users_wallet LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), deleted_at (DATETIME NULL)
--
-- Check demo_users_wallet
-- SELECT admin_id, master_id, deleted_at FROM demo_users_wallet LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), deleted_at (DATETIME NULL)
--
-- Check live_users_orders
-- SELECT admin_id, master_id, updated_at, deleted_at FROM live_users_orders LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), updated_at (DATETIME), deleted_at (DATETIME NULL)
--
-- Check demo_users_orders
-- SELECT admin_id, master_id, updated_at, deleted_at FROM demo_users_orders LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), updated_at (DATETIME), deleted_at (DATETIME NULL)
--
-- Check deposit_transactions
-- SELECT admin_id, master_id, updated_at, deleted_at FROM deposit_transactions LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), updated_at (DATETIME), deleted_at (DATETIME NULL)
--
-- Check withdrawal_transactions
-- SELECT admin_id, master_id, updated_at, deleted_at FROM withdrawal_transactions LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), updated_at (DATETIME), deleted_at (DATETIME NULL)
--
-- Check support
-- SELECT admin_id, master_id, updated_at, deleted_at FROM support LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), updated_at (DATETIME), deleted_at (DATETIME NULL)
--
-- Check users_login
-- SELECT admin_id, master_id, deleted_at FROM users_login LIMIT 1;
-- Expected: admin_id (INT NULL), master_id (INT NULL), deleted_at (DATETIME NULL)
--
-- Check users
-- SELECT master_id FROM users LIMIT 1;
-- Expected: master_id (INT NULL)

-- ============================================================================
-- INDEX VERIFICATION SCRIPT
-- ============================================================================
-- Check indexes were created
-- SHOW INDEXES FROM live_users_wallet;
-- SHOW INDEXES FROM demo_users_wallet;
-- SHOW INDEXES FROM live_users_orders;
-- SHOW INDEXES FROM demo_users_orders;
-- SHOW INDEXES FROM deposit_transactions;
-- SHOW INDEXES FROM withdrawal_transactions;
-- SHOW INDEXES FROM support;
-- SHOW INDEXES FROM users_login;
-- SHOW INDEXES FROM users;
-- SHOW INDEXES FROM admins;

-- ============================================================================
-- ROLLBACK SCRIPT (If needed to undo - NOT recommended in production)
-- ============================================================================
-- Note: Rollback will lose any data written to new columns
-- 
-- ALTER TABLE live_users_wallet DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE demo_users_wallet DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE live_users_orders DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE demo_users_orders DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE deposit_transactions DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE withdrawal_transactions DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE support DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE users_login DROP COLUMN IF EXISTS admin_id, DROP COLUMN IF EXISTS master_id, DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS master_id;
--
-- DROP INDEX IF EXISTS idx_live_wallet_user_id ON live_users_wallet;
-- DROP INDEX IF EXISTS idx_live_wallet_admin_id ON live_users_wallet;
-- DROP INDEX IF EXISTS idx_live_wallet_master_id ON live_users_wallet;
-- DROP INDEX IF EXISTS idx_live_wallet_deleted ON live_users_wallet;
-- [... continue for all indexes ...]

-- ============================================================================
-- END OF MIGRATION 004
-- ============================================================================


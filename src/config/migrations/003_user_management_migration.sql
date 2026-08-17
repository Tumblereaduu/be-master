-- ============================================================================
-- MIGRATION 003: User Management Schema Updates
-- ============================================================================
-- Add missing columns to users table for Phase 5 User Management APIs
-- These columns support multi-tenant user management and session control
--
-- WARNING: Do NOT delete or rename existing columns
-- WARNING: This file extends the table only, does NOT remove data

-- ============================================================================
-- ADD MISSING COLUMNS
-- ============================================================================

-- Add admin_id column (links user to admin for multi-tenant isolation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id INT NULL AFTER id;

-- Add master_id column (links user to master admin for reporting)
ALTER TABLE users ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER admin_id;

-- Add token_version column (for forced logout when password or status changes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1 AFTER user_status;

-- Add updated_at column (tracks when user was last modified)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER account_created_at;

-- Add deleted_at column (for soft delete - marks deleted users without removing rows)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for multi-tenant filtering (admin_id queries)
CREATE INDEX IF NOT EXISTS idx_users_admin_id ON users(admin_id);

-- Index for master reporting (master_id queries)
CREATE INDEX IF NOT EXISTS idx_users_master_id ON users(master_id);

-- Index for username lookups (uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Index for email lookups (already UNIQUE, but index for lookups)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for status filtering (active/inactive users)
CREATE INDEX IF NOT EXISTS idx_users_status ON users(user_status);

-- Index for soft delete queries (exclude deleted users)
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);

-- Composite index for admin user filtering
CREATE INDEX IF NOT EXISTS idx_users_admin_status ON users(admin_id, user_status);

-- ============================================================================
-- VERIFICATION SCRIPT (Run after migration to verify)
-- ============================================================================
-- SELECT 
--   id, admin_id, master_id, username, email, user_status, 
--   token_version, account_created_at, updated_at, deleted_at
-- FROM users LIMIT 1;
--
-- Expected output: All columns should exist
-- - admin_id: INT NULL
-- - master_id: INT NULL
-- - token_version: INT DEFAULT 1
-- - updated_at: DATETIME
-- - deleted_at: DATETIME NULL

-- ============================================================================
-- ROLLBACK SCRIPT (If needed to undo)
-- ============================================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS admin_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS master_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS token_version;
-- ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS idx_users_admin_id ON users;
-- DROP INDEX IF EXISTS idx_users_master_id ON users;
-- DROP INDEX IF EXISTS idx_users_username ON users;
-- DROP INDEX IF EXISTS idx_users_email ON users;
-- DROP INDEX IF EXISTS idx_users_status ON users;
-- DROP INDEX IF EXISTS idx_users_deleted ON users;
-- DROP INDEX IF EXISTS idx_users_admin_status ON users;

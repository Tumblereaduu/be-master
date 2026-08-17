-- ============================================================================
-- MIGRATION 002: Admin Management Schema Updates
-- ============================================================================
-- Add missing columns to admins table for Phase 4 Admin Management APIs
-- These columns support multi-tenant admin management and session control
--
-- WARNING: Do NOT delete, rename, or change existing columns
-- WARNING: This file extends the table only, does NOT remove data

-- ============================================================================
-- ADD MISSING COLUMNS
-- ============================================================================

-- Add master_id column (links admin to master admin for multi-tenant isolation)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS master_id INT NULL AFTER id;

-- Add phone column (admin contact number)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER permission;

-- Add domain column (unique domain for each admin)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS domain VARCHAR(255) NULL UNIQUE AFTER phone;

-- Add token_version column (for forced logout when password or status changes)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1 AFTER status;

-- Add updated_at column (tracks when admin was last modified)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Add deleted_at column (for soft delete - marks deleted admins without removing rows)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for multi-tenant filtering (master_id queries)
CREATE INDEX IF NOT EXISTS idx_admins_master_id ON admins(master_id);

-- Index for email lookups (login, uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email_id);

-- Index for domain lookups (uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_admins_domain ON admins(domain);

-- Index for status filtering (active/inactive admins)
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);

-- Index for soft delete queries (exclude deleted admins)
CREATE INDEX IF NOT EXISTS idx_admins_deleted ON admins(deleted_at);

-- ============================================================================
-- VERIFICATION SCRIPT (Run after migration to verify)
-- ============================================================================
-- SELECT 
--   id, master_id, admin_name, email_id, phone, domain, 
--   token_version, status, created_at, updated_at, deleted_at
-- FROM admins LIMIT 1;
--
-- Expected output: All columns should exist
-- - master_id: INT NULL
-- - phone: VARCHAR(20) NULL
-- - domain: VARCHAR(255) UNIQUE NULL
-- - token_version: INT DEFAULT 1
-- - updated_at: DATETIME
-- - deleted_at: DATETIME NULL

-- ============================================================================
-- ROLLBACK SCRIPT (If needed to undo)
-- ============================================================================
-- ALTER TABLE admins DROP COLUMN IF EXISTS master_id;
-- ALTER TABLE admins DROP COLUMN IF EXISTS phone;
-- ALTER TABLE admins DROP COLUMN IF EXISTS domain;
-- ALTER TABLE admins DROP COLUMN IF EXISTS token_version;
-- ALTER TABLE admins DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE admins DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS idx_admins_master_id ON admins;
-- DROP INDEX IF EXISTS idx_admins_email ON admins;
-- DROP INDEX IF EXISTS idx_admins_domain ON admins;
-- DROP INDEX IF EXISTS idx_admins_status ON admins;
-- DROP INDEX IF EXISTS idx_admins_deleted ON admins;

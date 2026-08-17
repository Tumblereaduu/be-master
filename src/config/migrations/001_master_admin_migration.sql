-- ============================================================================
-- MASTER ADMIN TABLE CREATION - STEP 3 Implementation Phase 1
-- ============================================================================
-- This migration creates the master_admin table for the SaaS multi-tenant system
-- Master admins are the top-level administrators who manage all admins and data
-- 
-- Execution: Run this before any master admin functionality
-- Status: CRITICAL - Required for Phase 3 testing and deployment
-- ============================================================================

-- Create master_admin table
CREATE TABLE IF NOT EXISTS master_admin (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Master admin unique identifier',
  
  email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Email address for login (must be unique)',
  password VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password (minimum 8 characters)',
  
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Account status for login validation',
  token_version INT DEFAULT 1 COMMENT 'Forced logout counter - increment to invalidate all sessions',
  
  company_name VARCHAR(255) NULL COMMENT 'Master admin company/organization name',
  logo_url VARCHAR(500) NULL COMMENT 'Company logo URL for branding',
  primary_color VARCHAR(7) DEFAULT '#1E88E5' COMMENT 'Primary brand color (hex format)',
  secondary_color VARCHAR(7) DEFAULT '#424242' COMMENT 'Secondary brand color (hex format)',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Account creation timestamp',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  deleted_at DATETIME NULL COMMENT 'Soft delete timestamp (NULL = not deleted)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Master administrators - top-level SaaS accounts';

-- Create indexes for optimal query performance
CREATE INDEX idx_master_admin_email ON master_admin(email) COMMENT 'Fast email lookups for login';
CREATE INDEX idx_master_admin_status ON master_admin(status) COMMENT 'Filter active/inactive masters';
CREATE INDEX idx_master_admin_deleted ON master_admin(deleted_at) COMMENT 'Soft delete filtering';

-- ============================================================================
-- VERIFICATION QUERY - Run after migration to verify table creation
-- ============================================================================
-- SELECT * FROM master_admin;
-- SELECT COUNT(*) as total_masters FROM master_admin WHERE deleted_at IS NULL;
-- ============================================================================


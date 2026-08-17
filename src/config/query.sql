-- users table
-- CREATE TABLE IF NOT EXISTS users (
--   id BIGINT AUTO_INCREMENT PRIMARY KEY,
--   username VARCHAR(100) NOT NULL,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   password_hash VARCHAR(255) NOT NULL,
--   mobile_number VARCHAR(20) DEFAULT NULL,
--   whatsapp_number VARCHAR(20) DEFAULT NULL,
--   referral_code VARCHAR(100) DEFAULT NULL,
--   is_active TINYINT(1) DEFAULT 1,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- users_email_otp table
CREATE TABLE IF NOT EXISTS users_email_otp (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  email_otp VARCHAR(10) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  status TINYINT(1) DEFAULT 0 -- 0 = unused, 1 = used
);

-- deposit table

create table deposit_transactions(
deposit_id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT NOT NULL,
username varchar(255) NOT NULL,
email VARCHAR(255) NOT NULL,
payment_method VARCHAR(50) NOT NULL,
currency_name VARCHAR(10) NOT NULL,
transaction_id varchar(255) NOT NULL,
enter_amount DECIMAL(40,2) NOT NULL,
requested_amount_usd DECIMAL(40,2),
transfer_amount_usd DECIMAL(40,2),
fee DECIMAL(40,2),
fee_percentage DECIMAL(40,2),
payment_screenshot varchar(255) NOT NULL,
deposit_request_at varchar(255),
deposit_status ENUM('pending','completed','rejected') DEFAULT 'pending',
deposit_reject_reason TEXT,
deposit_verified_at varchar(255),
upi_id varchar(255),
usdt_address varchar(255),
bank_account_number varchar(50),
bank_holder_name varchar(255),
bank_name varchar(255)
);

-- withdrawal table

create table withdrawal_transactions(
withdrawal_id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT NOT NULL,
username varchar(255) NOT NULL,
email VARCHAR(255) NOT NULL,
payment_method VARCHAR(50) NOT NULL,
requested_amount_usd DECIMAL(40,2) NOT NULL,
transfer_amount_usd DECIMAL(40,2) NOT NULL,
fee DECIMAL(40,2),
fee_percentage DECIMAL(40,2),
payment_address_upi_id varchar(255) NULL,
qr_payment_screenshot varchar(255) NULL,
withdrawal_request_at varchar(255),
withdrawal_status ENUM('pending','completed','rejected') DEFAULT 'pending',
withdrawal_reject_reason TEXT,
withdrawal_verified_at varchar(255),
bank_account_holder_name varchar(255),
bank_account_number varchar(50),
bank_ifsc_code varchar(50),
bank_name varchar(255),
bank_branch_name varchar(50),
country varchar(255)
);

-- support tickets

CREATE TABLE support (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    username VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) DEFAULT NULL,
    message TEXT DEFAULT NULL,
    message_img VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('open', 'closed', 'pending') DEFAULT 'open',
    replied_message TEXT DEFAULT NULL,
    replied_by VARCHAR(255) DEFAULT NULL,
    replied_at DATETIME DEFAULT NULL
);

-- User 
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45),
    select_account INT NOT NULL DEFAULT 1,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    confirm_password VARCHAR(255),
    account_created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    account_created_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    forgot_password_code VARCHAR(100),
    forgot_password_time DATETIME,
    forgot_password_timestamp TIMESTAMP NULL,
    forgot_password_code_expires_at DATETIME,
    whatsapp_number VARCHAR(20),
    date_of_birth VARCHAR(100),
    nationality VARCHAR(100),
    country VARCHAR(100),
    profile_completed TINYINT(1) DEFAULT 0,
    address VARCHAR(255),
    city VARCHAR(100),
    -- state VARCHAR(100),
    -- zip_code VARCHAR(20),
    register_from ENUM('web', 'mobile') DEFAULT 'web',
    photo_id_1_document_type VARCHAR(100),
    photo_id_2_document_type VARCHAR(100),
    photo_id_3_document_type VARCHAR(100), 
    photo_id_1 VARCHAR(255),
    photo_id_2 VARCHAR(255),
    photo_id_3 VARCHAR(255),
    photo_verification_status ENUM('pending', 'approved', 'rejected') DEFAULT null,
    photo_uploaded_at DATETIME,
    -- photo_verified_at DATETIME
    photo_verification_timestamp TIMESTAMP NULL,
    photo_id_1_status ENUM('pending', 'approved', 'rejected') DEFAULT null,
    photo_id_2_status ENUM('pending', 'approved', 'rejected') DEFAULT null,
    photo_id_3_status ENUM('pending', 'approved', 'rejected') DEFAULT null,
    photo_id_1_reason VARCHAR(255),
    photo_id_2_reason VARCHAR(255),
    photo_id_3_reason VARCHAR(255),
    user_status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    referral_id VARCHAR(100),
    referred_by_id VARCHAR(100),
    employment_status varchar(255),
    source_of_income VARCHAR(100),
    trading_experience varchar(255),
    income_range VARCHAR(100),
    occupation VARCHAR(100),
    account_type ENUM('demo', 'live') DEFAULT 'live',
    is_lp_added TINYINT(1) DEFAULT 1,
    ib_status ENUM("active","inactive") DEFAULT "active";
);

-- user Wallet
CREATE TABLE live_users_wallet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet DECIMAL(12,6) NOT NULL,
    used_margin DECIMAL(15,2) DEFAULT 0,
    after_used_margin DECIMAL(15,2) DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- user demo account

CREATE TABLE demo_users_wallet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet DECIMAL(12,6) NOT NULL,
    used_margin DECIMAL(15,2) DEFAULT 0,
    after_used_margin DECIMAL(15,2) DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- DEMO ORDERS
CREATE TABLE demo_users_orders (
  -- trade_id int(11) NOT NULL,
  trade_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id int(11) NOT NULL,
  symbol varchar(50) NOT NULL,
  type enum('BUY','SELL') NOT NULL,
  order_type enum('market','limit','advanced') DEFAULT 'market',
  lot_size decimal(10,5) NOT NULL,
  leverage int(11) DEFAULT 100,
  entry_price decimal(15,5) NOT NULL,
  entry_time datetime DEFAULT current_timestamp(),
  exit_price decimal(15,5) DEFAULT NULL,
  exit_time datetime DEFAULT NULL,
  used_margin decimal(15,2) DEFAULT 0.00,
  pnl decimal(15,2) DEFAULT 0.00,
  take_profit decimal(15,5) DEFAULT NULL,
  stop_loss decimal(15,5) DEFAULT NULL,
  tp_updated_at datetime DEFAULT NULL,
  sl_updated_at datetime DEFAULT NULL,
  order_status ENUM('active','pending','completed','cancelled', 'closed', 'pending_close', 'filled', 'square_off' ) DEFAULT 'active',
  fee decimal(10,2) DEFAULT 0.00,
  is_referral_code_added tinyint(1) DEFAULT 0,
  swap decimal(10,2) DEFAULT 0.00,
  commission decimal(10,2) DEFAULT 0.00,
  user_balance_after_trade decimal(15,2) DEFAULT 0.00,
  closed_by varchar(50) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp()
);

-- LIVE ORDERS
CREATE TABLE live_users_orders (
  trade_id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  type ENUM('BUY', 'SELL') NOT NULL,
  order_type ENUM('market', 'limit', 'advanced') DEFAULT 'market',
  lot_size DECIMAL(10,5) NOT NULL,
  leverage INT(11) DEFAULT 100,
  entry_price DECIMAL(15,5) NOT NULL,
  entry_time DATETIME DEFAULT CURRENT_TIMESTAMP(),
  exit_price DECIMAL(15,5) DEFAULT NULL,
  exit_time DATETIME DEFAULT NULL,
  used_margin DECIMAL(15,2) DEFAULT 0.00,
  pnl DECIMAL(15,2) DEFAULT 0.00,
  take_profit DECIMAL(15,5) DEFAULT NULL,
  stop_loss DECIMAL(15,5) DEFAULT NULL,
  tp_updated_at DATETIME DEFAULT NULL,
  sl_updated_at DATETIME DEFAULT NULL,
  order_status ENUM('active','pending','completed','cancelled', 'closed', 'pending_close', 'filled', 'square_off' ) DEFAULT 'active',
  fee DECIMAL(10,2) DEFAULT 0.00,
  is_referral_code_added TINYINT(1) DEFAULT 0,
  swap DECIMAL(10,2) DEFAULT 0.00,
  commission DECIMAL(10,2) DEFAULT 0.00,
  user_balance_after_trade DECIMAL(15,2) DEFAULT 0.00,
  closed_by VARCHAR(50) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (trade_id)
);


-- LIVE Favorites

CREATE TABLE live_favourites (
  id int(11) AUTO_INCREMENT PRIMARY KEY,
  user_id int(11) NOT NULL,
  symbol varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp()
);

-- DEMO Favorites

CREATE TABLE demo_favourites (
  id int(11) AUTO_INCREMENT PRIMARY KEY,
  user_id int(11) NOT NULL,
  symbol varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp()
);

-- Add fund history 

CREATE TABLE add_fund_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add Values Deposit

CREATE TABLE admin_panel_rate_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minimum_deposit DECIMAL(18,2),
    minimum_withdrawal DECIMAL(18,2),
    inr_value DECIMAL(18,2),
    bit_coin_value numeric(18,2),
    deposit_fee DECIMAL(18,2),
    withdrawal_fee DECIMAL(18,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Payment Mode

CREATE TABLE payment_method_admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_mode VARCHAR(255) , 
    qr_code VARCHAR(255),
    address VARCHAR(255),
    deposit_status ENUM('active', 'inactive') DEFAULT 'inactive',
    withdrawal_status ENUM('active', 'inactive') DEFAULT 'inactive',
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    bank_account_name VARCHAR(255),
    bank_name VARCHAR(255),
    bank_postal_code VARCHAR(20),
    bank_city VARCHAR(100),
    country VARCHAR(100),
    is_used ENUM('active', 'inactive') DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- alter table user_wallet
ALTER TABLE user_wallet
ADD COLUMN used_margin DECIMAL(15,2) DEFAULT 0 AFTER wallet,
ADD COLUMN after_used_margin DECIMAL(15,2) DEFAULT 0 AFTER used_margin;

-- Banner 

CREATE TABLE banner (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image VARCHAR(255) NOT NULL,            
    status ENUM('active', 'inactive') DEFAULT 'active', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP     
);

CREATE TABLE spread (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(255) NOT NULL,
  spread DECIMAL(18,2) NOT NULL,
  category VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ib_commission_percentage numeric(10,3)
);

CREATE TABLE admins (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_name VARCHAR(255) NOT NULL,
  email_id VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','subadmin','staff') DEFAULT 'admin',
  permission VARCHAR(255) DEFAULT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin contact Details

CREATE TABLE phone_email (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(20),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Login user shown

CREATE TABLE users_login (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     action ENUM('login', 'logout') DEFAULT NULL
);

-- Update History Wallet
CREATE TABLE update_wallet_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
ADD COLUMN profile_completed TINYINT(1) DEFAULT 0 AFTER country;

ALTER TABLE users
ADD COLUMN is_lp_added TINYINT(1) DEFAULT 1;

ALTER TABLE users
ADD COLUMN ib_status ENUM("active","inactive") DEFAULT "active";

ALTER table admin_panel_rate_settings add column bit_coin_value numeric(18,2);

-- IB Bounus table 

CREATE TABLE ib_users_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ib_id BIGINT UNSIGNED NULL,
  ib_kyc_id_1 VARCHAR(255) DEFAULT NULL,
  ib_kyc_id_2 VARCHAR(255) DEFAULT NULL,
  ib_kyc_id_3 VARCHAR(255) DEFAULT NULL,
  ib_kyc_id_4 VARCHAR(255) DEFAULT NULL,
  ib_kyc_id_5 VARCHAR(255) DEFAULT NULL,
  ib_kyc_id_6 VARCHAR(255) DEFAULT NULL,
  ib_photo_id_1_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_2_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_3_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_4_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_5_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_6_status ENUM('pending','approved','rejected') DEFAULT NULL,
  ib_photo_id_1_reason TEXT DEFAULT NULL,
  ib_photo_id_2_reason TEXT DEFAULT NULL,
  ib_photo_id_3_reason TEXT DEFAULT NULL,
  ib_photo_id_4_reason TEXT DEFAULT NULL,
  ib_photo_id_5_reason TEXT DEFAULT NULL,
  ib_photo_id_6_reason TEXT DEFAULT NULL,
  ib_kyc_status ENUM('pending','completed','rejected') DEFAULT NULL,
  ib_documents_uploaded_at DATETIME DEFAULT NULL,
  ib_documents_verified_at DATETIME DEFAULT NULL,
  total_earnings DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_id (user_id),
  INDEX idx_ib_kyc_status (ib_kyc_status)
);

CREATE TABLE ib_lot_commission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    lot_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE ib_transfer_history (
  ib_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  enter_amount DECIMAL(10,2) NOT NULL,
  transfer_amount_usd DECIMAL(10,2) DEFAULT NULL,
  deposit_request_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deposit_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  deposit_reject_reason TEXT DEFAULT NULL,
  deposit_verified_at DATETIME DEFAULT NULL
);

CREATE TABLE ib_users_commission_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ib_id BIGINT UNSIGNED NOT NULL,
  trade_id VARCHAR(50) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  commission_amount DECIMAL(10,5) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE spread ADD COLUMN ib_commission_percentage numeric(10,3)

AlTER TABLE live_users_orders
ADD COLUMN tp_pnl DECIMAL(15,2) DEFAULT NULL,
ADD COLUMN sl_pnl DECIMAL(15,2) DEFAULT NULL;

ALTER TABLE demo_users_orders
ADD COLUMN tp_pnl DECIMAL(15,2) DEFAULT NULL,
ADD COLUMN sl_pnl DECIMAL(15,2) DEFAULT NULL;

ALTER TABLE users
ADD COLUMN monitor_status TINYINT(1) DEFAULT 0;

CREATE TABLE support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_type ENUM('user','admin') NOT NULL,
    user_id INT NOT NULL,
    message TEXT,
    message_img TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_support (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT UNIQUE,
    user_id INT,
    username VARCHAR(255),
    email VARCHAR(255),
    subject VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('open','closed') DEFAULT 'open'
);

ALTER TABLE support_messages
MODIFY message TEXT NULL;

-- Add updated_at column to user_support table
ALTER TABLE user_support
ADD COLUMN updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP;

-- Initialize existing records with created_at value
UPDATE user_support
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE support ADD COLUMN chat_ended ENUM('yes','no') DEFAULT 'no';

ALTER TABLE support
ADD COLUMN updated_at DATETIME NULL;

ALTER TABLE support_messages
ADD COLUMN sender_id INT NULL;


-- Add location column if it does NOT exist
ALTER TABLE banner ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT 'dashboard';

-- Update any existing NULL records to have default 'dashboard'
UPDATE banner SET location = 'dashboard' WHERE location IS NULL OR location = '';

ALTER TABLE banner 
ADD COLUMN location VARCHAR(50) DEFAULT 'dashboard';

UPDATE banner 
SET location = 'dashboard' 
WHERE location IS NULL OR location = '';

-- Deposit table
ALTER TABLE deposit_transactions ADD COLUMN verified_by_admin_id INT NULL;
ALTER TABLE deposit_transactions ADD COLUMN verified_by_admin_name VARCHAR(255) NULL;


-- Withdrawal table
ALTER TABLE withdrawal_transactions ADD COLUMN verified_by_admin_id INT NULL;
ALTER TABLE withdrawal_transactions ADD COLUMN verified_by_admin_name VARCHAR(255) NULL;

-- Register table (KYC)
ALTER TABLE users ADD COLUMN photo_verified_by_admin_id INT NULL;
ALTER TABLE users ADD COLUMN photo_verified_by_admin_name VARCHAR(255) NULL;

-- Support table
ALTER TABLE support ADD COLUMN closed_by_admin_id INT NULL;
ALTER TABLE support ADD COLUMN closed_by_admin_name VARCHAR(255) NULL;

-- live user order
ALTER TABLE live_users_orders
ADD COLUMN is_hidden TINYINT(1) DEFAULT 0,
ADD COLUMN hidden_by INT NULL,
ADD COLUMN hidden_at DATETIME NULL;

-- deposit
ALTER TABLE deposit_transactions
ADD COLUMN is_hidden TINYINT(1) DEFAULT 0,
ADD COLUMN hidden_by INT NULL,
ADD COLUMN hidden_at DATETIME NULL;

-- withdrawal
ALTER TABLE withdrawal_transactions
ADD COLUMN is_hidden TINYINT(1) DEFAULT 0,
ADD COLUMN hidden_by INT NULL,
ADD COLUMN hidden_at DATETIME NULL;

-- Add ticket_source column to user_support table
ALTER TABLE user_support ADD COLUMN ticket_source VARCHAR(20) DEFAULT 'website';

ALTER TABLE user_deposit_transaction ADD COLUMN deposit_source VARCHAR(20) DEFAULT 'website' COMMENT 'Source: website or mobile_app';

-- Update existing NULL values to 'website'
UPDATE user_support SET ticket_source = 'website' WHERE ticket_source IS NULL;

ALTER TABLE support_tickets ADD COLUMN ticket_source VARCHAR(20) DEFAULT 'website' COMMENT 'Source: website or mobile_app';

ALTER TABLE user_kyc_details ADD COLUMN kyc_source VARCHAR(20) DEFAULT 'website' COMMENT 'Source: website or mobile_app';

ALTER TABLE live_users_orders ADD COLUMN trade_source VARCHAR(50) DEFAULT 'website' COMMENT 'website or mobile_app';

ALTER TABLE live_users_orders ADD COLUMN close_source VARCHAR(50) DEFAULT NULL COMMENT 'website or mobile_app - which platform closed the trade';

ALTER TABLE users_login ADD COLUMN login_source VARCHAR(50) DEFAULT 'website' COMMENT 'website or mobile_app';

ALTER TABLE payment_method_admin
ADD COLUMN nickname VARCHAR(100) NULL AFTER payment_mode;

CREATE TABLE `user_spreads` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `symbol` varchar(30) NOT NULL,
  `spread_id` int(11) DEFAULT NULL,
  `spread` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
);

-- GreenCart MySQL / MariaDB Schema (XAMPP / phpMyAdmin Compatible)
CREATE DATABASE IF NOT EXISTS `greencart`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `greencart`;

CREATE TABLE IF NOT EXISTS `accounts` (
  `account_id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `account_type` ENUM('customer', 'admin') NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `uq_accounts_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `product_id` INT NOT NULL AUTO_INCREMENT,
  `product_name` VARCHAR(160) NOT NULL,
  `description` TEXT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'Kitchen & Home',
  `image_url` TEXT NULL,
  `sku` VARCHAR(64) NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`product_id`),
  KEY `idx_products_name` (`product_name`),
  KEY `idx_products_category` (`category`),
  UNIQUE KEY `idx_products_sku` (`sku`),
  KEY `idx_products_archived` (`is_archived`),
  CONSTRAINT `chk_products_price` CHECK (`price` >= 0),
  CONSTRAINT `chk_products_archived` CHECK (`is_archived` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
  `inventory_id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `reorder_level` INT NOT NULL DEFAULT 10,
  `stock_status` ENUM('In Stock', 'Low Stock', 'Out of Stock') NOT NULL,
  PRIMARY KEY (`inventory_id`),
  UNIQUE KEY `uq_inventory_product` (`product_id`),
  CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_inventory_qty` CHECK (`quantity` >= 0),
  CONSTRAINT `chk_inventory_reorder` CHECK (`reorder_level` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `transaction_id` INT NOT NULL AUTO_INCREMENT,
  `account_id` INT NOT NULL,
  `transaction_date` VARCHAR(32) NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_transactions_account_date` (`account_id`, `transaction_date`),
  CONSTRAINT `fk_transactions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_transactions_total` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transaction_details` (
  `detail_id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`detail_id`),
  KEY `idx_details_tx` (`transaction_id`),
  KEY `idx_details_product` (`product_id`),
  CONSTRAINT `fk_details_tx` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_details_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_details_qty` CHECK (`quantity` > 0),
  CONSTRAINT `chk_details_subtotal` CHECK (`subtotal` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `digital_receipts` (
  `receipt_id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` INT NOT NULL,
  `qr_code` VARCHAR(128) NOT NULL,
  `receipt_date` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uq_receipts_tx` (`transaction_id`),
  UNIQUE KEY `uq_receipts_qr` (`qr_code`),
  CONSTRAINT `fk_receipts_tx` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `eco_impact` (
  `impact_id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` INT NOT NULL,
  `paper_saved` DECIMAL(10,2) NOT NULL,
  `carbon_reduction` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`impact_id`),
  UNIQUE KEY `uq_eco_tx` (`transaction_id`),
  CONSTRAINT `fk_eco_tx` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_eco_paper` CHECK (`paper_saved` >= 0),
  CONSTRAINT `chk_eco_carbon` CHECK (`carbon_reduction` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
  `adjustment_id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `account_id` INT NOT NULL,
  `delta` INT NOT NULL,
  `previous_qty` INT NOT NULL,
  `new_qty` INT NOT NULL,
  `reason` VARCHAR(160) NOT NULL,
  `adjusted_at` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`adjustment_id`),
  KEY `idx_inventory_adjustments_product_date` (`product_id`, `adjusted_at`),
  CONSTRAINT `fk_adjustments_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adjustments_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_adj_prev` CHECK (`previous_qty` >= 0),
  CONSTRAINT `chk_adj_new` CHECK (`new_qty` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

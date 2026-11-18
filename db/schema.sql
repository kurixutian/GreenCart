-- GreenCart Canonical Seven-Entity Relational Schema (SQLite / ANSI-compatible)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  account_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('customer', 'admin')),
  full_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL DEFAULT 'Kitchen & Home',
  image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS inventory (
  inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  stock_status TEXT NOT NULL CHECK (stock_status IN ('In Stock', 'Low Stock', 'Out of Stock')),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  transaction_date TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transaction_details (
  detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS digital_receipts (
  receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  receipt_date TEXT NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eco_impact (
  impact_id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL UNIQUE,
  paper_saved NUMERIC NOT NULL CHECK (paper_saved >= 0),
  carbon_reduction NUMERIC NOT NULL CHECK (carbon_reduction >= 0),
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

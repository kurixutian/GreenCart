-- Phase 3: Inventory Accountability
-- Adds configurable per-product low-stock threshold (reorder_level),
-- product archive status (is_archived), and inventory adjustment audit trail.

ALTER TABLE products ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);

ALTER TABLE inventory ADD COLUMN reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 1);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  adjustment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL CHECK (previous_qty >= 0),
  new_qty INTEGER NOT NULL CHECK (new_qty >= 0),
  reason TEXT NOT NULL,
  adjusted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product_date
  ON inventory_adjustments(product_id, adjusted_at DESC);

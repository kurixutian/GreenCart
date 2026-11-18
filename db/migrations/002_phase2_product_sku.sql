-- Migration 002: Phase 2 Product SKU / Barcode Support
-- Approved optional enhancement adding nullable unique SKU for fast POS lookup.
PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN sku TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

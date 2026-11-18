-- Migration 001: Phase 1 Product Images and Categories
-- Approved enhancement to canonical products entity: adds category and nullable image_url.
PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'Kitchen & Home';
ALTER TABLE products ADD COLUMN image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

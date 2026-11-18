import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = path.join(ROOT_DIR, 'db', 'schema.sql');
const SEED_PATH = path.join(ROOT_DIR, 'db', 'seed.sql');
const DEFAULT_DB_PATH = path.join(ROOT_DIR, 'data', 'greencart.sqlite');

const SEED_PRODUCT_META: Array<{ id: number; category: string; image_url: string }> = [
  { id: 1, category: 'Personal Care', image_url: '/images/products/product-1.svg' },
  { id: 2, category: 'Bags & Totes', image_url: '/images/products/product-2.svg' },
  { id: 3, category: 'Drinkware', image_url: '/images/products/product-3.svg' },
  { id: 4, category: 'Kitchen & Home', image_url: '/images/products/product-4.svg' },
  { id: 5, category: 'Personal Care', image_url: '/images/products/product-5.svg' },
  { id: 6, category: 'Stationery', image_url: '/images/products/product-6.svg' },
  { id: 7, category: 'Kitchen & Home', image_url: '/images/products/product-7.svg' },
  { id: 8, category: 'Kitchen & Home', image_url: '/images/products/product-8.svg' },
];

function ensurePhase1ProductColumns(db: DatabaseSync): void {
  const cols = db
    .prepare('PRAGMA table_info(products)')
    .all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  let migrated = false;
  if (!colNames.has('category')) {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'Kitchen & Home';");
    migrated = true;
  }
  if (!colNames.has('image_url')) {
    db.exec('ALTER TABLE products ADD COLUMN image_url TEXT;');
    migrated = true;
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);');

  if (migrated) {
    const stmt = db.prepare(
      'UPDATE products SET category = ?, image_url = COALESCE(image_url, ?) WHERE product_id = ?'
    );
    for (const meta of SEED_PRODUCT_META) {
      stmt.run(meta.category, meta.image_url, meta.id);
    }
  }
}

export function openDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const existingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
    .get() as { name: string } | undefined;

  if (existingTables) {
    ensurePhase1ProductColumns(db);
  }

  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);
  ensurePhase1ProductColumns(db);

  const countRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM accounts')
    .get() as { cnt: number };

  if (countRow.cnt === 0) {
    const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
    db.exec(seedSql);
  }

  return db;
}

export function resetDatabase(db: DatabaseSync): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      DELETE FROM eco_impact;
      DELETE FROM digital_receipts;
      DELETE FROM transaction_details;
      DELETE FROM transactions;
      DELETE FROM inventory;
      DELETE FROM products;
      DELETE FROM accounts;
      DELETE FROM sqlite_sequence;
    `);
    const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
    db.exec(seedSql);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

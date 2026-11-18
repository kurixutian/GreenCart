import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = path.join(ROOT_DIR, 'db', 'schema.sql');
const SEED_PATH = path.join(ROOT_DIR, 'db', 'seed.sql');
const DEFAULT_DB_PATH = path.join(ROOT_DIR, 'data', 'greencart.sqlite');

export function openDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

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

import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { openDatabase, resetDatabase } from './db.ts';

export interface DbExecResult {
  lastInsertRowid: number;
  changes: number;
}

export interface DbTxContext {
  readonly dialect: 'sqlite' | 'mysql';
  queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<DbExecResult>;
}

export interface DbClient extends DbTxContext {
  transaction<T>(fn: (tx: DbTxContext) => Promise<T>): Promise<T>;
  resetToSeed(): Promise<void>;
  close(): Promise<void>;
}

export function loadDotEnvIfPresent(envPath = path.join(process.cwd(), '.env')): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export class SqliteDbClient implements DbClient {
  readonly dialect = 'sqlite' as const;
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  async queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as unknown as T[];
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | undefined> {
    return this.db.prepare(sql).get(...(params as never[])) as unknown as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<DbExecResult> {
    const res = this.db.prepare(sql).run(...(params as never[]));
    return {
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      changes: Number(res.changes ?? 0),
    };
  }

  async transaction<T>(fn: (tx: DbTxContext) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async resetToSeed(): Promise<void> {
    resetDatabase(this.db);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class MysqlDbClient implements DbClient {
  readonly dialect = 'mysql' as const;
  private readonly pool: Pool;
  private readonly dbName: string;

  constructor(pool: Pool, dbName: string) {
    this.pool = pool;
    this.dbName = dbName;
  }

  async queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | undefined> {
    const rows = await this.queryAll<T>(sql, params);
    return rows[0];
  }

  async run(sql: string, params: unknown[] = []): Promise<DbExecResult> {
    const [res] = await this.pool.execute<ResultSetHeader>(sql, params as never[]);
    return {
      lastInsertRowid: Number(res.insertId ?? 0),
      changes: Number(res.affectedRows ?? 0),
    };
  }

  async transaction<T>(fn: (tx: DbTxContext) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();
    const txCtx: DbTxContext = {
      dialect: 'mysql',
      async queryAll<R = Record<string, unknown>>(sql: string, params: unknown[] = []) {
        const [rows] = await conn.query<RowDataPacket[]>(sql, params);
        return rows as unknown as R[];
      },
      async queryOne<R = Record<string, unknown>>(sql: string, params: unknown[] = []) {
        const [rows] = await conn.query<RowDataPacket[]>(sql, params);
        return (rows as unknown as R[])[0];
      },
      async run(sql: string, params: unknown[] = []) {
        const [res] = await conn.execute<ResultSetHeader>(sql, params as never[]);
        return {
          lastInsertRowid: Number(res.insertId ?? 0),
          changes: Number(res.affectedRows ?? 0),
        };
      },
    };
    try {
      const result = await fn(txCtx);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async resetToSeed(): Promise<void> {
    const seedPath = path.join(process.cwd(), 'db', 'seed.mysql.sql');
    const seedSql = fs
      .readFileSync(seedPath, 'utf8')
      .replace(/USE\s+`?greencart`?\s*;/gi, '');

    await this.transaction(async (tx) => {
      await tx.run('DELETE FROM `eco_impact`');
      await tx.run('DELETE FROM `digital_receipts`');
      await tx.run('DELETE FROM `transaction_details`');
      await tx.run('DELETE FROM `transactions`');
      await tx.run('DELETE FROM `inventory_adjustments`');
      await tx.run('DELETE FROM `inventory`');
      await tx.run('DELETE FROM `products`');
      await tx.run('DELETE FROM `accounts`');

      for (const stmt of seedSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('--'))) {
        await tx.run(stmt);
      }
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getDatabaseName(): string {
    return this.dbName;
  }
}

export async function openMysqlClient(): Promise<MysqlDbClient> {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const dbName = process.env.DB_NAME || 'greencart';

  // Ensure target database exists (safe for fresh XAMPP / phpMyAdmin instances)
  const bootstrapConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });
  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.mysql.sql');
    const rawSchema = fs.readFileSync(schemaPath, 'utf8');
    const safeSchema = rawSchema.replace(/`greencart`/g, `\`${dbName.replace(/`/g, '')}\``);
    await bootstrapConn.query(safeSchema);
  } finally {
    await bootstrapConn.end();
  }

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    multipleStatements: true,
  });

  const client = new MysqlDbClient(pool, dbName);
  const countRow = await client.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM `accounts`');
  if (!countRow || Number(countRow.cnt) === 0) {
    await client.resetToSeed();
  }
  return client;
}

export function createSqliteClient(dbOrPath?: DatabaseSync | string): SqliteDbClient {
  const db =
    typeof dbOrPath === 'string' || dbOrPath === undefined
      ? openDatabase(dbOrPath)
      : dbOrPath;
  return new SqliteDbClient(db);
}

export async function openConfiguredDbClient(): Promise<DbClient> {
  loadDotEnvIfPresent();
  const mode = (process.env.DB_CLIENT || '').trim().toLowerCase();
  if (mode === 'mysql') {
    return openMysqlClient();
  }
  return createSqliteClient();
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  generateOpaqueReceiptToken,
  hashPassword,
  verifyPassword,
} from './crypto.ts';
import {
  calculateEcoMetrics,
  type AccountRow,
  type AccountType,
  type CatalogItem,
  type DatabaseSnapshot,
  type DigitalReceiptRow,
  type DigitalReceiptView,
  type EcoImpactLedgerRow,
  type EcoImpactRow,
  type EcoImpactSummary,
  type EcoScope,
  type InventoryRow,
  type ProductRow,
  type PurchaseHistoryItem,
  type ReceiptLineItemView,
  type SafeUser,
  type SaleRequestPayload,
  type StockStatus,
  type TransactionDetailRow,
  type TransactionRow,
} from '../shared/types.ts';

export class AppError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function deriveStockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= 10) return 'Low Stock';
  return 'In Stock';
}

function toSafeUser(row: AccountRow): SafeUser {
  return {
    account_id: row.account_id,
    username: row.username,
    account_type: row.account_type,
    full_name: row.full_name,
  };
}

export class GreenCartService {
  private readonly db: DatabaseSync;
  private readonly processedCheckoutTokens = new Set<string>();
  private readonly inFlightCheckoutTokens = new Set<string>();

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  login(username: string, password: string): SafeUser {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) {
      throw new AppError(400, 'Username and password are required.');
    }

    const row = this.db
      .prepare(
        'SELECT account_id, username, password_hash, account_type, full_name FROM accounts WHERE LOWER(username) = ?'
      )
      .get(normalized) as AccountRow | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new AppError(401, 'Invalid username or password.');
    }

    return toSafeUser(row);
  }

  registerCustomer(input: {
    username: string;
    password: string;
    full_name: string;
    account_type?: string;
  }): SafeUser {
    if (input.account_type !== undefined && input.account_type !== 'customer') {
      throw new AppError(403, 'Public registration only permits customer accounts.');
    }

    const username = input.username.trim().toLowerCase();
    const fullName = input.full_name.trim();
    const password = input.password;

    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      throw new AppError(
        400,
        'Username must be 3-32 lowercase letters, numbers, or underscores.'
      );
    }
    if (fullName.length < 2 || fullName.length > 80) {
      throw new AppError(400, 'Full name must be between 2 and 80 characters.');
    }
    if (password.length < 6) {
      throw new AppError(400, 'Password must be at least 6 characters.');
    }

    const existing = this.db
      .prepare('SELECT account_id FROM accounts WHERE LOWER(username) = ?')
      .get(username) as { account_id: number } | undefined;

    if (existing) {
      throw new AppError(409, 'Username is already registered.');
    }

    const passwordHash = hashPassword(password);
    // Security rule: public registration always forces account_type = 'customer'
    const result = this.db
      .prepare(
        `INSERT INTO accounts (username, password_hash, account_type, full_name)
         VALUES (?, ?, 'customer', ?)`
      )
      .run(username, passwordHash, fullName);

    const created = this.db
      .prepare(
        'SELECT account_id, username, password_hash, account_type, full_name FROM accounts WHERE account_id = ?'
      )
      .get(Number(result.lastInsertRowid)) as unknown as AccountRow;

    return toSafeUser(created);
  }

  listCustomerAccounts(actorRole: AccountType): SafeUser[] {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Administrator access required.');
    }
    return this.db
      .prepare(
        `SELECT account_id, username, account_type, full_name
         FROM accounts
         WHERE account_type = 'customer'
         ORDER BY CASE WHEN username = 'walkin_customer' THEN 0 ELSE 1 END, full_name ASC`
      )
      .all() as unknown as SafeUser[];
  }

  listCatalog(search = '', statusFilter = 'ALL', categoryFilter = 'ALL'): CatalogItem[] {
    const query = search.trim().toLowerCase();
    const conditions: string[] = [];
    const params: string[] = [];

    if (query) {
      conditions.push('(LOWER(p.product_name) LIKE ? OR LOWER(p.description) LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    if (statusFilter && statusFilter !== 'ALL') {
      conditions.push('i.stock_status = ?');
      params.push(statusFilter);
    }

    if (categoryFilter && categoryFilter !== 'ALL') {
      conditions.push('p.category = ?');
      params.push(categoryFilter);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db
      .prepare(
        `SELECT
           p.product_id,
           p.product_name,
           p.description,
           CAST(p.price AS REAL) AS price,
           p.category,
           p.image_url,
           i.inventory_id,
           i.quantity,
           i.stock_status
         FROM products p
         INNER JOIN inventory i ON i.product_id = p.product_id
         ${whereClause}
         ORDER BY p.product_id ASC`
      )
      .all(...params) as unknown as CatalogItem[];
  }

  private normalizeImageUrl(raw?: string | null): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('/images/') ||
      trimmed.startsWith('/uploads/') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://')
    ) {
      return trimmed;
    }
    throw new AppError(
      400,
      'Image URL must be a relative /images/ or /uploads/ path or an HTTP(S) URL.'
    );
  }

  saveProductImageUpload(
    actorRole: AccountType,
    input: { filename: string; mimeType: string; base64Data: string }
  ): { image_url: string } {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Only administrators can upload product images.');
    }

    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    const ext = mimeToExt[input.mimeType.toLowerCase()];
    if (!ext) {
      throw new AppError(400, 'Unsupported image format. Use PNG, JPEG, WebP, or SVG.');
    }

    const cleanB64 = input.base64Data.replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanB64) {
      throw new AppError(400, 'Empty image upload payload.');
    }

    const buffer = Buffer.from(cleanB64, 'base64');
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
      throw new AppError(400, 'Image file size must be between 1 byte and 2 MB.');
    }

    if (ext === 'svg') {
      const text = buffer.toString('utf8');
      if (!text.includes('<svg') || /<script/i.test(text)) {
        throw new AppError(400, 'Invalid or unsafe SVG content.');
      }
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return { image_url: `/uploads/products/${fileName}` };
  }

  upsertProduct(
    actorRole: AccountType,
    input: {
      product_id?: number;
      product_name: string;
      description: string;
      price: number;
      quantity: number;
      category?: string;
      image_url?: string | null;
    }
  ): CatalogItem {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Only administrators can add or edit products.');
    }

    const productName = input.product_name.trim();
    const description = input.description.trim();
    const category = (input.category ?? 'Kitchen & Home').trim();
    const imageUrl = this.normalizeImageUrl(input.image_url);
    const price = Number(input.price);
    const quantity = Number(input.quantity);

    if (productName.length < 2 || productName.length > 120) {
      throw new AppError(400, 'Product name must be between 2 and 120 characters.');
    }
    if (description.length < 4 || description.length > 400) {
      throw new AppError(400, 'Description must be between 4 and 400 characters.');
    }
    if (category.length < 2 || category.length > 60) {
      throw new AppError(400, 'Category must be between 2 and 60 characters.');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, 'Price must be a non-negative number.');
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new AppError(400, 'Quantity must be a non-negative whole integer.');
    }

    const normalizedPrice = Number(price.toFixed(2));
    const stockStatus = deriveStockStatus(quantity);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      let targetProductId = input.product_id;

      if (targetProductId !== undefined) {
        const existing = this.db
          .prepare('SELECT product_id, image_url FROM products WHERE product_id = ?')
          .get(targetProductId) as { product_id: number; image_url: string | null } | undefined;
        if (!existing) {
          throw new AppError(404, 'Product not found.');
        }

        const effectiveImage =
          input.image_url === undefined ? existing.image_url : imageUrl;

        this.db
          .prepare(
            'UPDATE products SET product_name = ?, description = ?, price = ?, category = ?, image_url = ? WHERE product_id = ?'
          )
          .run(productName, description, normalizedPrice, category, effectiveImage, targetProductId);

        this.db
          .prepare('UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?')
          .run(quantity, stockStatus, targetProductId);
      } else {
        const insertProd = this.db
          .prepare(
            'INSERT INTO products (product_name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)'
          )
          .run(productName, description, normalizedPrice, category, imageUrl);
        targetProductId = Number(insertProd.lastInsertRowid);

        this.db
          .prepare(
            'INSERT INTO inventory (product_id, quantity, stock_status) VALUES (?, ?, ?)'
          )
          .run(targetProductId, quantity, stockStatus);
      }

      this.db.exec('COMMIT');

      const saved = this.db
        .prepare(
          `SELECT
             p.product_id, p.product_name, p.description, CAST(p.price AS REAL) AS price,
             p.category, p.image_url,
             i.inventory_id, i.quantity, i.stock_status
           FROM products p
           INNER JOIN inventory i ON i.product_id = p.product_id
           WHERE p.product_id = ?`
        )
        .get(targetProductId) as unknown as CatalogItem;

      return saved;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  adjustStock(actorRole: AccountType, productId: number, delta: number): CatalogItem {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Only administrators can adjust inventory.');
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid product ID.');
    }
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, 'Stock adjustment delta must be a non-zero integer.');
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.db
        .prepare('SELECT quantity FROM inventory WHERE product_id = ?')
        .get(productId) as { quantity: number } | undefined;

      if (!current) {
        throw new AppError(404, 'Product inventory record not found.');
      }

      const nextQuantity = current.quantity + delta;
      if (nextQuantity < 0) {
        throw new AppError(400, 'Stock quantity cannot become negative.');
      }

      const nextStatus = deriveStockStatus(nextQuantity);
      this.db
        .prepare('UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?')
        .run(nextQuantity, nextStatus, productId);

      this.db.exec('COMMIT');

      return this.db
        .prepare(
          `SELECT
             p.product_id, p.product_name, p.description, CAST(p.price AS REAL) AS price,
             p.category, p.image_url,
             i.inventory_id, i.quantity, i.stock_status
           FROM products p
           INNER JOIN inventory i ON i.product_id = p.product_id
           WHERE p.product_id = ?`
        )
        .get(productId) as unknown as CatalogItem;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  processSale(
    actor: SafeUser,
    payload: SaleRequestPayload,
    onBeforeCommitHook?: () => void
  ): DigitalReceiptView {
    const checkoutToken = payload.checkoutToken?.trim();
    if (!checkoutToken) {
      throw new AppError(400, 'Missing one-time checkoutToken for idempotency.');
    }
    if (
      this.processedCheckoutTokens.has(checkoutToken) ||
      this.inFlightCheckoutTokens.has(checkoutToken)
    ) {
      throw new AppError(409, 'Duplicate sale submission blocked.');
    }

    if (!Array.isArray(payload.lineItems) || payload.lineItems.length === 0) {
      throw new AppError(400, 'At least one item is required to complete a sale.');
    }

    // Merge duplicate product rows and validate positive integer quantities
    const mergedMap = new Map<number, number>();
    for (const item of payload.lineItems) {
      const productId = Number(item.product_id);
      const qty = Number(item.quantity);
      if (!Number.isInteger(productId) || productId <= 0) {
        throw new AppError(400, 'Each line item must reference a valid product_id.');
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new AppError(400, 'Line item quantities must be positive integers.');
      }
      mergedMap.set(productId, (mergedMap.get(productId) ?? 0) + qty);
    }

    let targetAccountId = actor.account_id;
    if (actor.account_type === 'customer') {
      if (payload.account_id !== undefined && payload.account_id !== actor.account_id) {
        throw new AppError(403, 'Customers can only place orders for their own account.');
      }
    } else if (payload.account_id !== undefined) {
      targetAccountId = Number(payload.account_id);
      if (!Number.isInteger(targetAccountId) || targetAccountId <= 0) {
        throw new AppError(400, 'Invalid customer account_id selected.');
      }
    }

    this.inFlightCheckoutTokens.add(checkoutToken);
    let committed = false;

    try {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const targetAccount = this.db
          .prepare('SELECT account_id, account_type FROM accounts WHERE account_id = ?')
          .get(targetAccountId) as { account_id: number; account_type: AccountType } | undefined;

        if (!targetAccount) {
          throw new AppError(404, 'Selected customer account does not exist.');
        }

        const verifiedLines: Array<{
          product_id: number;
          product_name: string;
          quantity: number;
          unitCents: number;
          subtotalCents: number;
          remainingStock: number;
        }> = [];

        let totalCents = 0;

        for (const [productId, requestedQty] of mergedMap.entries()) {
          const row = this.db
            .prepare(
              `SELECT p.product_id, p.product_name, CAST(p.price AS REAL) AS price, i.quantity AS stock_qty
               FROM products p
               INNER JOIN inventory i ON i.product_id = p.product_id
               WHERE p.product_id = ?`
            )
            .get(productId) as
            | { product_id: number; product_name: string; price: number; stock_qty: number }
            | undefined;

          if (!row) {
            throw new AppError(404, `Product #${productId} does not exist.`);
          }
          if (row.stock_qty < requestedQty) {
            throw new AppError(
              400,
              `Insufficient stock for "${row.product_name}" (available: ${row.stock_qty}, requested: ${requestedQty}).`
            );
          }

          // Server-side authoritative pricing in integer centavos
          const unitCents = Math.round(Number(row.price) * 100);
          const subtotalCents = unitCents * requestedQty;
          totalCents += subtotalCents;

          verifiedLines.push({
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: requestedQty,
            unitCents,
            subtotalCents,
            remainingStock: row.stock_qty - requestedQty,
          });
        }

        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const totalAmount = Number((totalCents / 100).toFixed(2));

        const txResult = this.db
          .prepare(
            `INSERT INTO transactions (account_id, transaction_date, total_amount)
             VALUES (?, ?, ?)`
          )
          .run(targetAccountId, timestamp, totalAmount);

        const transactionId = Number(txResult.lastInsertRowid);

        const insertDetailStmt = this.db.prepare(
          `INSERT INTO transaction_details (transaction_id, product_id, quantity, subtotal)
           VALUES (?, ?, ?, ?)`
        );
        const updateInventoryStmt = this.db.prepare(
          `UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?`
        );

        for (const line of verifiedLines) {
          insertDetailStmt.run(
            transactionId,
            line.product_id,
            line.quantity,
            Number((line.subtotalCents / 100).toFixed(2))
          );
          updateInventoryStmt.run(
            line.remainingStock,
            deriveStockStatus(line.remainingStock),
            line.product_id
          );
        }

        let qrCode = generateOpaqueReceiptToken();
        while (
          this.db
            .prepare('SELECT receipt_id FROM digital_receipts WHERE qr_code = ?')
            .get(qrCode)
        ) {
          qrCode = generateOpaqueReceiptToken();
        }

        this.db
          .prepare(
            `INSERT INTO digital_receipts (transaction_id, qr_code, receipt_date)
             VALUES (?, ?, ?)`
          )
          .run(transactionId, qrCode, timestamp);

        const eco = calculateEcoMetrics(verifiedLines.length);
        this.db
          .prepare(
            `INSERT INTO eco_impact (transaction_id, paper_saved, carbon_reduction)
             VALUES (?, ?, ?)`
          )
          .run(transactionId, eco.paper_saved, eco.carbon_reduction);

        if (onBeforeCommitHook) {
          onBeforeCommitHook();
        }

        this.db.exec('COMMIT');
        committed = true;
        this.processedCheckoutTokens.add(checkoutToken);

        return this.loadReceiptByTransactionIdInternal(transactionId);
      } catch (err) {
        if (!committed) {
          this.db.exec('ROLLBACK');
        }
        throw err;
      }
    } finally {
      this.inFlightCheckoutTokens.delete(checkoutToken);
    }
  }

  private loadReceiptByTransactionIdInternal(transactionId: number): DigitalReceiptView {
    const header = this.db
      .prepare(
        `SELECT
           dr.receipt_id,
           t.transaction_id,
           dr.qr_code,
           dr.receipt_date,
           t.transaction_date,
           CAST(t.total_amount AS REAL) AS total_amount,
           a.account_id AS customer_account_id,
           a.full_name AS customer_name,
           a.username AS customer_username,
           CAST(ei.paper_saved AS REAL) AS paper_saved,
           CAST(ei.carbon_reduction AS REAL) AS carbon_reduction
         FROM transactions t
         INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
         INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
         INNER JOIN accounts a ON a.account_id = t.account_id
         WHERE t.transaction_id = ?`
      )
      .get(transactionId) as Omit<DigitalReceiptView, 'items'> | undefined;

    if (!header) {
      throw new AppError(404, 'Receipt not found.');
    }

    const items = this.db
      .prepare(
        `SELECT
           td.detail_id,
           td.product_id,
           p.product_name,
           td.quantity,
           ROUND(CAST(td.subtotal AS REAL) / td.quantity, 2) AS unit_price,
           CAST(td.subtotal AS REAL) AS subtotal
         FROM transaction_details td
         INNER JOIN products p ON p.product_id = td.product_id
         WHERE td.transaction_id = ?
         ORDER BY td.detail_id ASC`
      )
      .all(transactionId) as unknown as ReceiptLineItemView[];

    return {
      ...header,
      items,
    };
  }

  getReceiptByToken(qrCode: string, actor: SafeUser): DigitalReceiptView {
    const token = qrCode.trim().toUpperCase();
    if (!token) {
      throw new AppError(400, 'QR receipt token is required.');
    }

    const row = this.db
      .prepare(
        `SELECT dr.transaction_id, t.account_id, a.username
         FROM digital_receipts dr
         INNER JOIN transactions t ON t.transaction_id = dr.transaction_id
         INNER JOIN accounts a ON a.account_id = t.account_id
         WHERE UPPER(dr.qr_code) = ?`
      )
      .get(token) as { transaction_id: number; account_id: number; username: string } | undefined;

    if (!row) {
      throw new AppError(404, 'No digital receipt matched that QR token.');
    }

    if (
      actor.account_type === 'customer' &&
      row.account_id !== actor.account_id &&
      row.username !== 'walkin_customer'
    ) {
      throw new AppError(403, 'Access denied: this receipt belongs to another customer.');
    }

    return this.loadReceiptByTransactionIdInternal(row.transaction_id);
  }

  getReceiptByTransactionId(transactionId: number, actor: SafeUser): DigitalReceiptView {
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      throw new AppError(400, 'Invalid transaction ID.');
    }

    const row = this.db
      .prepare('SELECT transaction_id, account_id FROM transactions WHERE transaction_id = ?')
      .get(transactionId) as { transaction_id: number; account_id: number } | undefined;

    if (!row) {
      throw new AppError(404, 'Receipt not found.');
    }

    if (actor.account_type === 'customer' && row.account_id !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot view another customer’s private receipt.');
    }

    return this.loadReceiptByTransactionIdInternal(row.transaction_id);
  }

  getCustomerHistory(actor: SafeUser, requestedAccountId?: number): PurchaseHistoryItem[] {
    const targetAccountId = requestedAccountId ?? actor.account_id;
    if (actor.account_type === 'customer' && targetAccountId !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot view another customer’s purchase history.');
    }

    return this.db
      .prepare(
        `SELECT
           t.transaction_id,
           t.transaction_date,
           CAST(t.total_amount AS REAL) AS total_amount,
           dr.qr_code,
           dr.receipt_date,
           COUNT(td.detail_id) AS item_count,
           COALESCE(SUM(td.quantity), 0) AS total_units,
           CAST(ei.paper_saved AS REAL) AS paper_saved,
           CAST(ei.carbon_reduction AS REAL) AS carbon_reduction
         FROM transactions t
         INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
         INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
         LEFT JOIN transaction_details td ON td.transaction_id = t.transaction_id
         WHERE t.account_id = ?
         GROUP BY t.transaction_id
         ORDER BY t.transaction_date DESC, t.transaction_id DESC`
      )
      .all(targetAccountId) as unknown as PurchaseHistoryItem[];
  }

  getEcoImpactSummary(actor: SafeUser, requestedScope: EcoScope = 'personal'): EcoImpactSummary {
    const effectiveScope: EcoScope = actor.account_type === 'admin' ? 'store' : requestedScope;
    const isPersonal = effectiveScope === 'personal';

    const whereClause = isPersonal ? 'WHERE t.account_id = ?' : '';
    const params = isPersonal ? [actor.account_id] : [];

    const agg = this.db
      .prepare(
        `SELECT
           COUNT(ei.impact_id) AS paperless_count,
           COALESCE(ROUND(SUM(CAST(ei.paper_saved AS REAL)), 2), 0) AS total_paper_saved,
           COALESCE(ROUND(SUM(CAST(ei.carbon_reduction AS REAL)), 2), 0) AS total_carbon_reduction
         FROM eco_impact ei
         INNER JOIN transactions t ON t.transaction_id = ei.transaction_id
         ${whereClause}`
      )
      .get(...params) as {
      paperless_count: number;
      total_paper_saved: number;
      total_carbon_reduction: number;
    };

    const ledger = this.db
      .prepare(
        `SELECT
           t.transaction_id,
           t.transaction_date,
           dr.qr_code,
           a.full_name AS customer_name,
           CAST(t.total_amount AS REAL) AS total_amount,
           CAST(ei.paper_saved AS REAL) AS paper_saved,
           CAST(ei.carbon_reduction AS REAL) AS carbon_reduction
         FROM eco_impact ei
         INNER JOIN transactions t ON t.transaction_id = ei.transaction_id
         INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
         INNER JOIN accounts a ON a.account_id = t.account_id
         ${whereClause}
         ORDER BY t.transaction_date DESC, t.transaction_id DESC`
      )
      .all(...params) as unknown as EcoImpactLedgerRow[];

    return {
      scope: effectiveScope,
      paperless_count: Number(agg.paperless_count),
      total_paper_saved: Number(agg.total_paper_saved),
      total_carbon_reduction: Number(agg.total_carbon_reduction),
      formula_note:
        'Estimated impact: 1.00 base receipt sheet + 0.25 sheets per distinct line item; 3.50 g CO2e avoided per thermal sheet saved.',
      ledger,
    };
  }

  getDatabaseSnapshot(actor: SafeUser): DatabaseSnapshot {
    if (actor.account_type !== 'admin') {
      throw new AppError(403, 'Administrator access required to inspect full database tables.');
    }

    const accounts = this.db
      .prepare(
        'SELECT account_id, username, account_type, full_name FROM accounts ORDER BY account_id ASC'
      )
      .all() as unknown as SafeUser[];
    const products = this.db
      .prepare(
        'SELECT product_id, product_name, description, CAST(price AS REAL) AS price, category, image_url FROM products ORDER BY product_id ASC'
      )
      .all() as unknown as ProductRow[];
    const inventory = this.db
      .prepare(
        'SELECT inventory_id, product_id, quantity, stock_status FROM inventory ORDER BY inventory_id ASC'
      )
      .all() as unknown as InventoryRow[];
    const transactions = this.db
      .prepare(
        'SELECT transaction_id, account_id, transaction_date, CAST(total_amount AS REAL) AS total_amount FROM transactions ORDER BY transaction_id ASC'
      )
      .all() as unknown as TransactionRow[];
    const transaction_details = this.db
      .prepare(
        'SELECT detail_id, transaction_id, product_id, quantity, CAST(subtotal AS REAL) AS subtotal FROM transaction_details ORDER BY detail_id ASC'
      )
      .all() as unknown as TransactionDetailRow[];
    const digital_receipts = this.db
      .prepare(
        'SELECT receipt_id, transaction_id, qr_code, receipt_date FROM digital_receipts ORDER BY receipt_id ASC'
      )
      .all() as unknown as DigitalReceiptRow[];
    const eco_impact = this.db
      .prepare(
        'SELECT impact_id, transaction_id, CAST(paper_saved AS REAL) AS paper_saved, CAST(carbon_reduction AS REAL) AS carbon_reduction FROM eco_impact ORDER BY impact_id ASC'
      )
      .all() as unknown as EcoImpactRow[];

    return {
      accounts,
      products,
      inventory,
      transactions,
      transaction_details,
      digital_receipts,
      eco_impact,
    };
  }
}

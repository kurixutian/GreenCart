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
  type AdminTransactionFilter,
  type AdminTransactionItem,
  type AdminTransactionSort,
  type CatalogItem,
  type DatabaseSnapshot,
  type DigitalReceiptRow,
  type DigitalReceiptView,
  type EcoImpactLedgerRow,
  type EcoImpactRow,
  type EcoImpactSummary,
  type EcoScope,
  type InventoryAdjustmentView,
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

export function deriveStockStatus(quantity: number, reorderLevel = 10): StockStatus {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

function sanitizeCsvCell(val: string | number | null | undefined): string {
  const raw = val === null || val === undefined ? '' : String(val);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
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

  getAccountById(accountId: number): SafeUser | null {
    if (!Number.isInteger(accountId) || accountId <= 0) return null;
    const row = this.db
      .prepare(
        'SELECT account_id, username, account_type, full_name FROM accounts WHERE account_id = ?'
      )
      .get(accountId) as SafeUser | undefined;
    return row ?? null;
  }

  updateAccountProfile(
    actor: SafeUser,
    input: { full_name: string; account_id?: number }
  ): SafeUser {
    if (input.account_id !== undefined && Number(input.account_id) !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot modify another user’s profile.');
    }

    const fullName = input.full_name.trim();
    if (fullName.length < 2 || fullName.length > 80) {
      throw new AppError(400, 'Full name must be between 2 and 80 characters.');
    }

    this.db
      .prepare('UPDATE accounts SET full_name = ? WHERE account_id = ?')
      .run(fullName, actor.account_id);

    const updated = this.getAccountById(actor.account_id);
    if (!updated) {
      throw new AppError(404, 'Account not found.');
    }
    return updated;
  }

  changePassword(
    actor: SafeUser,
    input: { currentPassword: string; newPassword: string; account_id?: number }
  ): void {
    if (input.account_id !== undefined && Number(input.account_id) !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot change another user’s password.');
    }
    if (!input.currentPassword) {
      throw new AppError(400, 'Current password is required.');
    }
    if (input.newPassword.length < 6 || input.newPassword.length > 128) {
      throw new AppError(400, 'New password must be between 6 and 128 characters.');
    }

    const row = this.db
      .prepare('SELECT account_id, password_hash FROM accounts WHERE account_id = ?')
      .get(actor.account_id) as { account_id: number; password_hash: string } | undefined;

    if (!row) {
      throw new AppError(404, 'Account not found.');
    }
    if (!verifyPassword(input.currentPassword, row.password_hash)) {
      throw new AppError(400, 'Current password is incorrect.');
    }

    const nextHash = hashPassword(input.newPassword);
    this.db
      .prepare('UPDATE accounts SET password_hash = ? WHERE account_id = ?')
      .run(nextHash, actor.account_id);
  }

  listCatalog(
    search = '',
    statusFilter = 'ALL',
    categoryFilter = 'ALL',
    includeArchived = false
  ): CatalogItem[] {
    const query = search.trim().toLowerCase();
    const conditions: string[] = [];
    const params: string[] = [];

    if (!includeArchived) {
      conditions.push('p.is_archived = 0');
    }

    if (query) {
      conditions.push(
        "(LOWER(p.product_name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(COALESCE(p.sku, '')) LIKE ?)"
      );
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
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
           p.sku,
           p.is_archived,
           i.inventory_id,
           i.quantity,
           i.reorder_level,
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

  private normalizeSku(raw?: string | null): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return null;
    if (!/^[A-Z0-9-]{3,32}$/.test(trimmed)) {
      throw new AppError(
        400,
        'SKU/barcode must be 3–32 uppercase letters, numbers, or hyphens.'
      );
    }
    return trimmed;
  }

  private resolveAdminActorId(
    actorOrRole: SafeUser | AccountType,
    forbiddenMessage: string
  ): number {
    const role = typeof actorOrRole === 'string' ? actorOrRole : actorOrRole.account_type;
    if (role !== 'admin') {
      throw new AppError(403, forbiddenMessage);
    }
    if (typeof actorOrRole !== 'string') {
      return actorOrRole.account_id;
    }
    const adminRow = this.db
      .prepare("SELECT account_id FROM accounts WHERE account_type = 'admin' ORDER BY account_id ASC LIMIT 1")
      .get() as { account_id: number } | undefined;
    if (!adminRow) {
      throw new AppError(403, forbiddenMessage);
    }
    return adminRow.account_id;
  }

  private getCatalogItemById(productId: number): CatalogItem {
    return this.db
      .prepare(
        `SELECT
           p.product_id, p.product_name, p.description, CAST(p.price AS REAL) AS price,
           p.category, p.image_url, p.sku, p.is_archived,
           i.inventory_id, i.quantity, i.reorder_level, i.stock_status
         FROM products p
         INNER JOIN inventory i ON i.product_id = p.product_id
         WHERE p.product_id = ?`
      )
      .get(productId) as unknown as CatalogItem;
  }

  upsertProduct(
    actorOrRole: SafeUser | AccountType,
    input: {
      product_id?: number;
      product_name: string;
      description: string;
      price: number;
      quantity: number;
      reorder_level?: number;
      is_archived?: boolean | number;
      category?: string;
      image_url?: string | null;
      sku?: string | null;
      adjustment_reason?: string;
    }
  ): CatalogItem {
    const actorId = this.resolveAdminActorId(
      actorOrRole,
      'Only administrators can add or edit products.'
    );

    const productName = input.product_name.trim();
    const description = input.description.trim();
    const category = (input.category ?? 'Kitchen & Home').trim();
    const imageUrl = this.normalizeImageUrl(input.image_url);
    const normalizedSku = input.sku === undefined ? undefined : this.normalizeSku(input.sku);
    const price = Number(input.price);
    const quantity = Number(input.quantity);
    const reorderLevelInput =
      input.reorder_level === undefined ? undefined : Number(input.reorder_level);

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
    if (
      reorderLevelInput !== undefined &&
      (!Number.isInteger(reorderLevelInput) || reorderLevelInput < 1 || reorderLevelInput > 10000)
    ) {
      throw new AppError(400, 'Reorder level must be a whole integer between 1 and 10000.');
    }

    const normalizedPrice = Number(price.toFixed(2));
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      let targetProductId = input.product_id;

      if (normalizedSku) {
        const duplicate = this.db
          .prepare('SELECT product_id FROM products WHERE UPPER(sku) = ? AND product_id != ?')
          .get(normalizedSku, targetProductId ?? -1) as { product_id: number } | undefined;
        if (duplicate) {
          throw new AppError(409, 'SKU/barcode is already assigned to another product.');
        }
      }

      if (targetProductId !== undefined) {
        const existing = this.db
          .prepare(
            `SELECT p.product_id, p.image_url, p.sku, p.is_archived, i.quantity, i.reorder_level
             FROM products p
             INNER JOIN inventory i ON i.product_id = p.product_id
             WHERE p.product_id = ?`
          )
          .get(targetProductId) as
          | {
              product_id: number;
              image_url: string | null;
              sku: string | null;
              is_archived: number;
              quantity: number;
              reorder_level: number;
            }
          | undefined;
        if (!existing) {
          throw new AppError(404, 'Product not found.');
        }

        const effectiveImage =
          input.image_url === undefined ? existing.image_url : imageUrl;
        const effectiveSku =
          normalizedSku === undefined ? existing.sku : normalizedSku;
        const effectiveReorderLevel = reorderLevelInput ?? existing.reorder_level;
        const effectiveArchived =
          input.is_archived === undefined
            ? existing.is_archived
            : input.is_archived
              ? 1
              : 0;
        const stockStatus = deriveStockStatus(quantity, effectiveReorderLevel);

        this.db
          .prepare(
            'UPDATE products SET product_name = ?, description = ?, price = ?, category = ?, image_url = ?, sku = ?, is_archived = ? WHERE product_id = ?'
          )
          .run(
            productName,
            description,
            normalizedPrice,
            category,
            effectiveImage,
            effectiveSku,
            effectiveArchived,
            targetProductId
          );

        this.db
          .prepare('UPDATE inventory SET quantity = ?, reorder_level = ?, stock_status = ? WHERE product_id = ?')
          .run(quantity, effectiveReorderLevel, stockStatus, targetProductId);

        if (quantity !== existing.quantity) {
          const reason = (input.adjustment_reason || 'Inventory count update').trim().slice(0, 120);
          this.db
            .prepare(
              `INSERT INTO inventory_adjustments
                 (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              targetProductId,
              actorId,
              quantity - existing.quantity,
              existing.quantity,
              quantity,
              reason || 'Inventory count update',
              timestamp
            );
        }
      } else {
        const effectiveReorderLevel = reorderLevelInput ?? 10;
        const effectiveArchived = input.is_archived ? 1 : 0;
        const stockStatus = deriveStockStatus(quantity, effectiveReorderLevel);

        const insertProd = this.db
          .prepare(
            'INSERT INTO products (product_name, description, price, category, image_url, sku, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            productName,
            description,
            normalizedPrice,
            category,
            imageUrl,
            normalizedSku ?? null,
            effectiveArchived
          );
        targetProductId = Number(insertProd.lastInsertRowid);

        this.db
          .prepare(
            'INSERT INTO inventory (product_id, quantity, reorder_level, stock_status) VALUES (?, ?, ?, ?)'
          )
          .run(targetProductId, quantity, effectiveReorderLevel, stockStatus);

        if (quantity > 0) {
          this.db
            .prepare(
              `INSERT INTO inventory_adjustments
                 (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              targetProductId,
              actorId,
              quantity,
              0,
              quantity,
              'Initial stock entry',
              timestamp
            );
        }
      }

      this.db.exec('COMMIT');

      return this.getCatalogItemById(targetProductId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  adjustStock(
    actorOrRole: SafeUser | AccountType,
    productId: number,
    delta: number,
    reason = 'Quick stock adjustment'
  ): CatalogItem {
    const actorId = this.resolveAdminActorId(
      actorOrRole,
      'Only administrators can adjust inventory.'
    );
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid product ID.');
    }
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError(400, 'Stock adjustment delta must be a non-zero integer.');
    }
    const cleanReason = reason.trim();
    if (!cleanReason || cleanReason.length > 120) {
      throw new AppError(400, 'Adjustment reason must be between 1 and 120 characters.');
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.db
        .prepare('SELECT quantity, reorder_level FROM inventory WHERE product_id = ?')
        .get(productId) as { quantity: number; reorder_level: number } | undefined;

      if (!current) {
        throw new AppError(404, 'Product inventory record not found.');
      }

      const nextQuantity = current.quantity + delta;
      if (nextQuantity < 0) {
        throw new AppError(400, 'Stock quantity cannot become negative.');
      }

      const nextStatus = deriveStockStatus(nextQuantity, current.reorder_level);
      this.db
        .prepare('UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?')
        .run(nextQuantity, nextStatus, productId);

      this.db
        .prepare(
          `INSERT INTO inventory_adjustments
             (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(productId, actorId, delta, current.quantity, nextQuantity, cleanReason, timestamp);

      this.db.exec('COMMIT');

      return this.getCatalogItemById(productId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  setProductArchived(
    actorOrRole: SafeUser | AccountType,
    productId: number,
    isArchived: boolean
  ): CatalogItem {
    this.resolveAdminActorId(
      actorOrRole,
      'Only administrators can archive or restore products.'
    );
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid product ID.');
    }

    const existing = this.db
      .prepare('SELECT product_id FROM products WHERE product_id = ?')
      .get(productId) as { product_id: number } | undefined;
    if (!existing) {
      throw new AppError(404, 'Product not found.');
    }

    this.db
      .prepare('UPDATE products SET is_archived = ? WHERE product_id = ?')
      .run(isArchived ? 1 : 0, productId);

    return this.getCatalogItemById(productId);
  }

  listInventoryAdjustments(
    actorRole: AccountType,
    productId?: number,
    limit = 100
  ): InventoryAdjustmentView[] {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Only administrators can inspect inventory adjustment history.');
    }
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const whereClause = productId && Number.isInteger(productId) && productId > 0 ? 'WHERE ia.product_id = ?' : '';
    const params: number[] = [];
    if (whereClause) {
      params.push(productId!);
    }
    params.push(safeLimit);

    return this.db
      .prepare(
        `SELECT
           ia.adjustment_id,
           ia.product_id,
           p.product_name,
           p.sku,
           ia.account_id,
           a.full_name AS actor_name,
           ia.delta,
           ia.previous_qty,
           ia.new_qty,
           ia.reason,
           ia.adjusted_at
         FROM inventory_adjustments ia
         INNER JOIN products p ON p.product_id = ia.product_id
         INNER JOIN accounts a ON a.account_id = ia.account_id
         ${whereClause}
         ORDER BY ia.adjustment_id DESC
         LIMIT ?`
      )
      .all(...params) as unknown as InventoryAdjustmentView[];
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
          reorderLevel: number;
        }> = [];

        let totalCents = 0;

        for (const [productId, requestedQty] of mergedMap.entries()) {
          const row = this.db
            .prepare(
              `SELECT p.product_id, p.product_name, p.is_archived, CAST(p.price AS REAL) AS price, i.quantity AS stock_qty, i.reorder_level
               FROM products p
               INNER JOIN inventory i ON i.product_id = p.product_id
               WHERE p.product_id = ?`
            )
            .get(productId) as
            | {
                product_id: number;
                product_name: string;
                is_archived: number;
                price: number;
                stock_qty: number;
                reorder_level: number;
              }
            | undefined;

          if (!row) {
            throw new AppError(404, `Product #${productId} does not exist.`);
          }
          if (row.is_archived) {
            throw new AppError(
              400,
              `"${row.product_name}" is archived and no longer available for sale.`
            );
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
            reorderLevel: row.reorder_level,
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
            deriveStockStatus(line.remainingStock, line.reorderLevel),
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

  searchTransactions(
    actorRole: AccountType,
    filters: AdminTransactionFilter = {}
  ): AdminTransactionItem[] {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Administrator access required to search all store transactions.');
    }

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const search = filters.search?.trim().toLowerCase() ?? '';
    if (search) {
      conditions.push(
        '(CAST(t.transaction_id AS TEXT) LIKE ? OR LOWER(dr.qr_code) LIKE ? OR LOWER(a.full_name) LIKE ? OR LOWER(a.username) LIKE ?)'
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (filters.customerAccountId !== undefined) {
      const custId = Number(filters.customerAccountId);
      if (!Number.isInteger(custId) || custId <= 0) {
        throw new AppError(400, 'Invalid customer account filter.');
      }
      conditions.push('t.account_id = ?');
      params.push(custId);
    }

    if (filters.dateFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
        throw new AppError(400, 'Invalid dateFrom format (expected YYYY-MM-DD).');
      }
      conditions.push('substr(t.transaction_date, 1, 10) >= ?');
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
        throw new AppError(400, 'Invalid dateTo format (expected YYYY-MM-DD).');
      }
      conditions.push('substr(t.transaction_date, 1, 10) <= ?');
      params.push(filters.dateTo);
    }

    const sortMap: Record<AdminTransactionSort, string> = {
      newest: 't.transaction_date DESC, t.transaction_id DESC',
      oldest: 't.transaction_date ASC, t.transaction_id ASC',
      highest: 'CAST(t.total_amount AS REAL) DESC, t.transaction_id DESC',
      lowest: 'CAST(t.total_amount AS REAL) ASC, t.transaction_id DESC',
    };
    const sortKey: AdminTransactionSort = filters.sort ?? 'newest';
    const orderBy = sortMap[sortKey];
    if (!orderBy) {
      throw new AppError(400, 'Invalid sort parameter.');
    }

    const limit = Math.min(500, Math.max(1, Number(filters.limit) || 200));
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    return this.db
      .prepare(
        `SELECT
           t.transaction_id,
           t.account_id,
           a.username AS customer_username,
           a.full_name AS customer_name,
           t.transaction_date,
           CAST(t.total_amount AS REAL) AS total_amount,
           dr.qr_code,
           dr.receipt_date,
           COUNT(td.detail_id) AS item_count,
           COALESCE(SUM(td.quantity), 0) AS total_units,
           CAST(ei.paper_saved AS REAL) AS paper_saved,
           CAST(ei.carbon_reduction AS REAL) AS carbon_reduction
         FROM transactions t
         INNER JOIN accounts a ON a.account_id = t.account_id
         INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
         INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
         LEFT JOIN transaction_details td ON td.transaction_id = t.transaction_id
         ${whereClause}
         GROUP BY t.transaction_id
         ORDER BY ${orderBy}
         LIMIT ?`
      )
      .all(...params) as unknown as AdminTransactionItem[];
  }

  exportTransactionsCsv(
    actorRole: AccountType,
    filters: AdminTransactionFilter = {}
  ): string {
    const rows = this.searchTransactions(actorRole, {
      ...filters,
      limit: filters.limit ?? 500,
    });
    const header = [
      'transaction_id',
      'transaction_date',
      'customer_username',
      'customer_name',
      'qr_code',
      'item_count',
      'total_units',
      'total_amount_php',
      'paper_saved_sheets',
      'carbon_reduction_g',
    ].join(',');

    const lines = rows.map((row) =>
      [
        row.transaction_id,
        row.transaction_date,
        row.customer_username,
        row.customer_name,
        row.qr_code,
        row.item_count,
        row.total_units,
        Number(row.total_amount).toFixed(2),
        Number(row.paper_saved).toFixed(2),
        Number(row.carbon_reduction).toFixed(2),
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );

    return [header, ...lines].join('\r\n');
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
        'SELECT product_id, product_name, description, CAST(price AS REAL) AS price, category, image_url, sku, is_archived FROM products ORDER BY product_id ASC'
      )
      .all() as unknown as ProductRow[];
    const inventory = this.db
      .prepare(
        'SELECT inventory_id, product_id, quantity, reorder_level, stock_status FROM inventory ORDER BY inventory_id ASC'
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

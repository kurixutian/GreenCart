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
  createSqliteClient,
  type DbClient,
  type DbTxContext,
} from './dbClient.ts';
import {
  ECO_IMPACT_SPEC,
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
  statusCode: number;

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
    account_id: Number(row.account_id),
    username: row.username,
    account_type: row.account_type,
    full_name: row.full_name,
  };
}

export class GreenCartService {
  private readonly db: DbClient;
  private readonly processedCheckoutTokens = new Set<string>();
  private readonly inFlightCheckoutTokens = new Set<string>();

  constructor(dbOrClient: DbClient | DatabaseSync) {
    this.db =
      typeof (dbOrClient as DbClient).queryAll === 'function'
        ? (dbOrClient as DbClient)
        : createSqliteClient(dbOrClient as DatabaseSync);
  }

  async login(username: string, password: string): Promise<SafeUser> {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) {
      throw new AppError(400, 'Username and password are required.');
    }

    const row = await this.db.queryOne<AccountRow>(
      'SELECT account_id, username, password_hash, account_type, full_name FROM accounts WHERE LOWER(username) = ?',
      [normalized]
    );

    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new AppError(401, 'Invalid username or password.');
    }

    return toSafeUser(row);
  }

  async registerCustomer(input: {
    username: string;
    password: string;
    full_name: string;
    account_type?: string;
  }): Promise<SafeUser> {
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

    const existing = await this.db.queryOne<{ account_id: number }>(
      'SELECT account_id FROM accounts WHERE LOWER(username) = ?',
      [username]
    );

    if (existing) {
      throw new AppError(409, 'Username is already registered.');
    }

    const passwordHash = hashPassword(password);
    // Security rule: public registration always forces account_type = 'customer'
    const result = await this.db.run(
      `INSERT INTO accounts (username, password_hash, account_type, full_name)
       VALUES (?, ?, 'customer', ?)`,
      [username, passwordHash, fullName]
    );

    const created = await this.db.queryOne<AccountRow>(
      'SELECT account_id, username, password_hash, account_type, full_name FROM accounts WHERE account_id = ?',
      [result.lastInsertRowid]
    );

    return toSafeUser(created!);
  }

  async listCustomerAccounts(actorRole: AccountType): Promise<SafeUser[]> {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Administrator access required.');
    }
    return this.db.queryAll<SafeUser>(
      `SELECT account_id, username, account_type, full_name
       FROM accounts
       WHERE account_type = 'customer'
       ORDER BY CASE WHEN username = 'walkin_customer' THEN 0 ELSE 1 END, full_name ASC`
    );
  }

  async getAccountById(accountId: number): Promise<SafeUser | null> {
    if (!Number.isInteger(accountId) || accountId <= 0) return null;
    const row = await this.db.queryOne<SafeUser>(
      'SELECT account_id, username, account_type, full_name FROM accounts WHERE account_id = ?',
      [accountId]
    );
    return row ?? null;
  }

  async updateAccountProfile(
    actor: SafeUser,
    input: { full_name: string; account_id?: number }
  ): Promise<SafeUser> {
    if (input.account_id !== undefined && Number(input.account_id) !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot modify another user’s profile.');
    }

    const fullName = input.full_name.trim();
    if (fullName.length < 2 || fullName.length > 80) {
      throw new AppError(400, 'Full name must be between 2 and 80 characters.');
    }

    await this.db.run('UPDATE accounts SET full_name = ? WHERE account_id = ?', [
      fullName,
      actor.account_id,
    ]);

    const updated = await this.getAccountById(actor.account_id);
    if (!updated) {
      throw new AppError(404, 'Account not found.');
    }
    return updated;
  }

  async changePassword(
    actor: SafeUser,
    input: { currentPassword: string; newPassword: string; account_id?: number }
  ): Promise<void> {
    if (input.account_id !== undefined && Number(input.account_id) !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot change another user’s password.');
    }
    if (!input.currentPassword) {
      throw new AppError(400, 'Current password is required.');
    }
    if (input.newPassword.length < 6 || input.newPassword.length > 128) {
      throw new AppError(400, 'New password must be between 6 and 128 characters.');
    }

    const row = await this.db.queryOne<{ account_id: number; password_hash: string }>(
      'SELECT account_id, password_hash FROM accounts WHERE account_id = ?',
      [actor.account_id]
    );

    if (!row) {
      throw new AppError(404, 'Account not found.');
    }
    if (!verifyPassword(input.currentPassword, row.password_hash)) {
      throw new AppError(400, 'Current password is incorrect.');
    }

    const nextHash = hashPassword(input.newPassword);
    await this.db.run('UPDATE accounts SET password_hash = ? WHERE account_id = ?', [
      nextHash,
      actor.account_id,
    ]);
  }

  async listCatalog(
    search = '',
    statusFilter = 'ALL',
    categoryFilter = 'ALL',
    includeArchived = false
  ): Promise<CatalogItem[]> {
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

    const rows = await this.db.queryAll<CatalogItem>(
      `SELECT
         p.product_id,
         p.product_name,
         p.description,
         CAST(p.price AS DECIMAL(10, 2)) AS price,
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
       ORDER BY p.product_id ASC`,
      params
    );
    return rows.map((r) => ({ ...r, price: Number(r.price) }));
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

  private async resolveAdminActorId(
    actorOrRole: SafeUser | AccountType,
    forbiddenMessage: string
  ): Promise<number> {
    const role = typeof actorOrRole === 'string' ? actorOrRole : actorOrRole.account_type;
    if (role !== 'admin') {
      throw new AppError(403, forbiddenMessage);
    }
    if (typeof actorOrRole !== 'string') {
      return actorOrRole.account_id;
    }
    const adminRow = await this.db.queryOne<{ account_id: number }>(
      "SELECT account_id FROM accounts WHERE account_type = 'admin' ORDER BY account_id ASC LIMIT 1"
    );
    if (!adminRow) {
      throw new AppError(403, forbiddenMessage);
    }
    return Number(adminRow.account_id);
  }

  private async getCatalogItemById(productId: number): Promise<CatalogItem> {
    const row = await this.db.queryOne<CatalogItem>(
      `SELECT
         p.product_id, p.product_name, p.description, CAST(p.price AS DECIMAL(10, 2)) AS price,
         p.category, p.image_url, p.sku, p.is_archived,
         i.inventory_id, i.quantity, i.reorder_level, i.stock_status
       FROM products p
       INNER JOIN inventory i ON i.product_id = p.product_id
       WHERE p.product_id = ?`,
      [productId]
    );
    return { ...row!, price: Number(row!.price) };
  }

  async upsertProduct(
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
  ): Promise<CatalogItem> {
    const actorId = await this.resolveAdminActorId(
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

    const savedId = await this.db.transaction(async (tx: DbTxContext) => {
      let targetProductId = input.product_id;

      if (normalizedSku) {
        const duplicate = await tx.queryOne<{ product_id: number }>(
          'SELECT product_id FROM products WHERE UPPER(sku) = ? AND product_id != ?',
          [normalizedSku, targetProductId ?? -1]
        );
        if (duplicate) {
          throw new AppError(409, 'SKU/barcode is already assigned to another product.');
        }
      }

      if (targetProductId !== undefined) {
        const existing = await tx.queryOne<{
          product_id: number;
          image_url: string | null;
          sku: string | null;
          is_archived: number;
          quantity: number;
          reorder_level: number;
        }>(
          `SELECT p.product_id, p.image_url, p.sku, p.is_archived, i.quantity, i.reorder_level
           FROM products p
           INNER JOIN inventory i ON i.product_id = p.product_id
           WHERE p.product_id = ?`,
          [targetProductId]
        );
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

        await tx.run(
          'UPDATE products SET product_name = ?, description = ?, price = ?, category = ?, image_url = ?, sku = ?, is_archived = ? WHERE product_id = ?',
          [
            productName,
            description,
            normalizedPrice,
            category,
            effectiveImage,
            effectiveSku,
            effectiveArchived,
            targetProductId,
          ]
        );

        await tx.run(
          'UPDATE inventory SET quantity = ?, reorder_level = ?, stock_status = ? WHERE product_id = ?',
          [quantity, effectiveReorderLevel, stockStatus, targetProductId]
        );

        if (quantity !== existing.quantity) {
          const reason = (input.adjustment_reason || 'Inventory count update').trim().slice(0, 120);
          await tx.run(
            `INSERT INTO inventory_adjustments
               (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              targetProductId,
              actorId,
              quantity - existing.quantity,
              existing.quantity,
              quantity,
              reason || 'Inventory count update',
              timestamp,
            ]
          );
        }
      } else {
        const effectiveReorderLevel = reorderLevelInput ?? 10;
        const effectiveArchived = input.is_archived ? 1 : 0;
        const stockStatus = deriveStockStatus(quantity, effectiveReorderLevel);

        const insertProd = await tx.run(
          'INSERT INTO products (product_name, description, price, category, image_url, sku, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            productName,
            description,
            normalizedPrice,
            category,
            imageUrl,
            normalizedSku ?? null,
            effectiveArchived,
          ]
        );
        targetProductId = insertProd.lastInsertRowid;

        await tx.run(
          'INSERT INTO inventory (product_id, quantity, reorder_level, stock_status) VALUES (?, ?, ?, ?)',
          [targetProductId, quantity, effectiveReorderLevel, stockStatus]
        );

        if (quantity > 0) {
          await tx.run(
            `INSERT INTO inventory_adjustments
               (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [targetProductId, actorId, quantity, 0, quantity, 'Initial stock entry', timestamp]
          );
        }
      }

      return targetProductId;
    });

    return this.getCatalogItemById(savedId);
  }

  async adjustStock(
    actorOrRole: SafeUser | AccountType,
    productId: number,
    delta: number,
    reason = 'Quick stock adjustment'
  ): Promise<CatalogItem> {
    const actorId = await this.resolveAdminActorId(
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

    await this.db.transaction(async (tx) => {
      const lockClause = tx.dialect === 'mysql' ? ' FOR UPDATE' : '';
      const current = await tx.queryOne<{ quantity: number; reorder_level: number }>(
        `SELECT quantity, reorder_level FROM inventory WHERE product_id = ?${lockClause}`,
        [productId]
      );

      if (!current) {
        throw new AppError(404, 'Product inventory record not found.');
      }

      const nextQuantity = current.quantity + delta;
      if (nextQuantity < 0) {
        throw new AppError(400, 'Stock quantity cannot become negative.');
      }

      const nextStatus = deriveStockStatus(nextQuantity, current.reorder_level);
      await tx.run('UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?', [
        nextQuantity,
        nextStatus,
        productId,
      ]);

      await tx.run(
        `INSERT INTO inventory_adjustments
           (product_id, account_id, delta, previous_qty, new_qty, reason, adjusted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [productId, actorId, delta, current.quantity, nextQuantity, cleanReason, timestamp]
      );
    });

    return this.getCatalogItemById(productId);
  }

  async setProductArchived(
    actorOrRole: SafeUser | AccountType,
    productId: number,
    isArchived: boolean
  ): Promise<CatalogItem> {
    await this.resolveAdminActorId(
      actorOrRole,
      'Only administrators can archive or restore products.'
    );
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid product ID.');
    }

    const existing = await this.db.queryOne<{ product_id: number }>(
      'SELECT product_id FROM products WHERE product_id = ?',
      [productId]
    );
    if (!existing) {
      throw new AppError(404, 'Product not found.');
    }

    await this.db.run('UPDATE products SET is_archived = ? WHERE product_id = ?', [
      isArchived ? 1 : 0,
      productId,
    ]);

    return this.getCatalogItemById(productId);
  }

  async listInventoryAdjustments(
    actorRole: AccountType,
    productId?: number,
    limit = 100
  ): Promise<InventoryAdjustmentView[]> {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Only administrators can inspect inventory adjustment history.');
    }
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const whereClause =
      productId && Number.isInteger(productId) && productId > 0 ? 'WHERE ia.product_id = ?' : '';
    const params: number[] = [];
    if (whereClause) {
      params.push(productId!);
    }
    params.push(safeLimit);

    return this.db.queryAll<InventoryAdjustmentView>(
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
       LIMIT ?`,
      params
    );
  }

  async processSale(
    actor: SafeUser,
    payload: SaleRequestPayload,
    onBeforeCommitHook?: () => void
  ): Promise<DigitalReceiptView> {
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
      const transactionId = await this.db.transaction(async (tx) => {
        const targetAccount = await tx.queryOne<{
          account_id: number;
          account_type: AccountType;
        }>('SELECT account_id, account_type FROM accounts WHERE account_id = ?', [
          targetAccountId,
        ]);

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
        const lockClause = tx.dialect === 'mysql' ? ' FOR UPDATE' : '';

        for (const [productId, requestedQty] of mergedMap.entries()) {
          const row = await tx.queryOne<{
            product_id: number;
            product_name: string;
            is_archived: number;
            price: number;
            stock_qty: number;
            reorder_level: number;
          }>(
            `SELECT p.product_id, p.product_name, p.is_archived, CAST(p.price AS DECIMAL(10, 2)) AS price, i.quantity AS stock_qty, i.reorder_level
             FROM products p
             INNER JOIN inventory i ON i.product_id = p.product_id
             WHERE p.product_id = ?${lockClause}`,
            [productId]
          );

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

        const txResult = await tx.run(
          `INSERT INTO transactions (account_id, transaction_date, total_amount)
           VALUES (?, ?, ?)`,
          [targetAccountId, timestamp, totalAmount]
        );

        const nextTransactionId = txResult.lastInsertRowid;

        for (const line of verifiedLines) {
          await tx.run(
            `INSERT INTO transaction_details (transaction_id, product_id, quantity, subtotal)
             VALUES (?, ?, ?, ?)`,
            [
              nextTransactionId,
              line.product_id,
              line.quantity,
              Number((line.subtotalCents / 100).toFixed(2)),
            ]
          );
          await tx.run(
            `UPDATE inventory SET quantity = ?, stock_status = ? WHERE product_id = ?`,
            [
              line.remainingStock,
              deriveStockStatus(line.remainingStock, line.reorderLevel),
              line.product_id,
            ]
          );
        }

        let qrCode = generateOpaqueReceiptToken();
        while (
          await tx.queryOne<{ receipt_id: number }>(
            'SELECT receipt_id FROM digital_receipts WHERE qr_code = ?',
            [qrCode]
          )
        ) {
          qrCode = generateOpaqueReceiptToken();
        }

        await tx.run(
          `INSERT INTO digital_receipts (transaction_id, qr_code, receipt_date)
           VALUES (?, ?, ?)`,
          [nextTransactionId, qrCode, timestamp]
        );

        const eco = calculateEcoMetrics(verifiedLines.length);
        await tx.run(
          `INSERT INTO eco_impact (transaction_id, paper_saved, carbon_reduction)
           VALUES (?, ?, ?)`,
          [nextTransactionId, eco.paper_saved, eco.carbon_reduction]
        );

        if (onBeforeCommitHook) {
          onBeforeCommitHook();
        }

        return nextTransactionId;
      });

      committed = true;
      this.processedCheckoutTokens.add(checkoutToken);
      return await this.loadReceiptByTransactionIdInternal(transactionId);
    } finally {
      this.inFlightCheckoutTokens.delete(checkoutToken);
      if (!committed) {
        this.processedCheckoutTokens.delete(checkoutToken);
      }
    }
  }

  private async loadReceiptByTransactionIdInternal(
    transactionId: number
  ): Promise<DigitalReceiptView> {
    const header = await this.db.queryOne<Omit<DigitalReceiptView, 'items'>>(
      `SELECT
         dr.receipt_id,
         t.transaction_id,
         dr.qr_code,
         dr.receipt_date,
         t.transaction_date,
         CAST(t.total_amount AS DECIMAL(10, 2)) AS total_amount,
         a.account_id AS customer_account_id,
         a.full_name AS customer_name,
         a.username AS customer_username,
         CAST(ei.paper_saved AS DECIMAL(10, 2)) AS paper_saved,
         CAST(ei.carbon_reduction AS DECIMAL(10, 2)) AS carbon_reduction
       FROM transactions t
       INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
       INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
       INNER JOIN accounts a ON a.account_id = t.account_id
       WHERE t.transaction_id = ?`,
      [transactionId]
    );

    if (!header) {
      throw new AppError(404, 'Receipt not found.');
    }

    const items = await this.db.queryAll<ReceiptLineItemView>(
      `SELECT
         td.detail_id,
         td.product_id,
         p.product_name,
         td.quantity,
         ROUND(CAST(td.subtotal AS DECIMAL(10, 2)) / td.quantity, 2) AS unit_price,
         CAST(td.subtotal AS DECIMAL(10, 2)) AS subtotal
       FROM transaction_details td
       INNER JOIN products p ON p.product_id = td.product_id
       WHERE td.transaction_id = ?
       ORDER BY td.detail_id ASC`,
      [transactionId]
    );

    return {
      ...header,
      total_amount: Number(header.total_amount),
      paper_saved: Number(header.paper_saved),
      carbon_reduction: Number(header.carbon_reduction),
      items: items.map((i) => ({
        ...i,
        unit_price: Number(i.unit_price),
        subtotal: Number(i.subtotal),
      })),
    };
  }

  async getReceiptByToken(qrCode: string, actor: SafeUser): Promise<DigitalReceiptView> {
    const token = qrCode.trim().toUpperCase();
    if (!token) {
      throw new AppError(400, 'QR receipt token is required.');
    }

    const row = await this.db.queryOne<{
      transaction_id: number;
      account_id: number;
      username: string;
    }>(
      `SELECT t.transaction_id, t.account_id, a.username
       FROM digital_receipts dr
       INNER JOIN transactions t ON t.transaction_id = dr.transaction_id
       INNER JOIN accounts a ON a.account_id = t.account_id
       WHERE UPPER(dr.qr_code) = ?`,
      [token]
    );

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

  async getReceiptByTransactionId(
    transactionId: number,
    actor: SafeUser
  ): Promise<DigitalReceiptView> {
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      throw new AppError(400, 'Invalid transaction ID.');
    }

    const row = await this.db.queryOne<{ transaction_id: number; account_id: number }>(
      'SELECT transaction_id, account_id FROM transactions WHERE transaction_id = ?',
      [transactionId]
    );

    if (!row) {
      throw new AppError(404, 'Receipt not found.');
    }

    if (actor.account_type === 'customer' && row.account_id !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot view another customer’s private receipt.');
    }

    return this.loadReceiptByTransactionIdInternal(row.transaction_id);
  }

  async getCustomerHistory(
    actor: SafeUser,
    requestedAccountId?: number
  ): Promise<PurchaseHistoryItem[]> {
    const targetAccountId = requestedAccountId ?? actor.account_id;
    if (actor.account_type === 'customer' && targetAccountId !== actor.account_id) {
      throw new AppError(403, 'Access denied: cannot view another customer’s purchase history.');
    }

    const rows = await this.db.queryAll<PurchaseHistoryItem>(
      `SELECT
         t.transaction_id,
         t.transaction_date,
         CAST(t.total_amount AS DECIMAL(10, 2)) AS total_amount,
         dr.qr_code,
         dr.receipt_date,
         COUNT(td.detail_id) AS item_count,
         COALESCE(SUM(td.quantity), 0) AS total_units,
         CAST(ei.paper_saved AS DECIMAL(10, 2)) AS paper_saved,
         CAST(ei.carbon_reduction AS DECIMAL(10, 2)) AS carbon_reduction
       FROM transactions t
       INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
       INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
       LEFT JOIN transaction_details td ON td.transaction_id = t.transaction_id
       WHERE t.account_id = ?
       GROUP BY t.transaction_id, t.transaction_date, t.total_amount, dr.qr_code, dr.receipt_date, ei.paper_saved, ei.carbon_reduction
       ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      [targetAccountId]
    );

    return rows.map((r) => ({
      ...r,
      total_amount: Number(r.total_amount),
      item_count: Number(r.item_count),
      total_units: Number(r.total_units),
      paper_saved: Number(r.paper_saved),
      carbon_reduction: Number(r.carbon_reduction),
    }));
  }

  async searchTransactions(
    actorRole: AccountType,
    filters: AdminTransactionFilter = {}
  ): Promise<AdminTransactionItem[]> {
    if (actorRole !== 'admin') {
      throw new AppError(403, 'Administrator access required to search all store transactions.');
    }

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const search = filters.search?.trim().toLowerCase() ?? '';
    if (search) {
      conditions.push(
        '(t.transaction_id LIKE ? OR LOWER(dr.qr_code) LIKE ? OR LOWER(a.full_name) LIKE ? OR LOWER(a.username) LIKE ?)'
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
      conditions.push('t.transaction_date >= ?');
      params.push(`${filters.dateFrom} 00:00:00`);
    }

    if (filters.dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
        throw new AppError(400, 'Invalid dateTo format (expected YYYY-MM-DD).');
      }
      conditions.push('t.transaction_date <= ?');
      params.push(`${filters.dateTo} 23:59:59`);
    }

    const sortMap: Record<AdminTransactionSort, string> = {
      newest: 't.transaction_date DESC, t.transaction_id DESC',
      oldest: 't.transaction_date ASC, t.transaction_id ASC',
      highest: 'CAST(t.total_amount AS DECIMAL(10, 2)) DESC, t.transaction_id DESC',
      lowest: 'CAST(t.total_amount AS DECIMAL(10, 2)) ASC, t.transaction_id DESC',
    };
    const sortKey: AdminTransactionSort = filters.sort ?? 'newest';
    const orderBy = sortMap[sortKey];
    if (!orderBy) {
      throw new AppError(400, 'Invalid sort parameter.');
    }

    const limit = Math.min(500, Math.max(1, Number(filters.limit) || 200));
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const rows = await this.db.queryAll<AdminTransactionItem>(
      `SELECT
         t.transaction_id,
         t.account_id,
         a.username AS customer_username,
         a.full_name AS customer_name,
         t.transaction_date,
         CAST(t.total_amount AS DECIMAL(10, 2)) AS total_amount,
         dr.qr_code,
         dr.receipt_date,
         COUNT(td.detail_id) AS item_count,
         COALESCE(SUM(td.quantity), 0) AS total_units,
         CAST(ei.paper_saved AS DECIMAL(10, 2)) AS paper_saved,
         CAST(ei.carbon_reduction AS DECIMAL(10, 2)) AS carbon_reduction
       FROM transactions t
       INNER JOIN accounts a ON a.account_id = t.account_id
       INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
       INNER JOIN eco_impact ei ON ei.transaction_id = t.transaction_id
       LEFT JOIN transaction_details td ON td.transaction_id = t.transaction_id
       ${whereClause}
       GROUP BY t.transaction_id, t.account_id, a.username, a.full_name, t.transaction_date, t.total_amount, dr.qr_code, dr.receipt_date, ei.paper_saved, ei.carbon_reduction
       ORDER BY ${orderBy}
       LIMIT ?`,
      params
    );

    return rows.map((r) => ({
      ...r,
      total_amount: Number(r.total_amount),
      item_count: Number(r.item_count),
      total_units: Number(r.total_units),
      paper_saved: Number(r.paper_saved),
      carbon_reduction: Number(r.carbon_reduction),
    }));
  }

  async exportTransactionsCsv(
    actorRole: AccountType,
    filters: AdminTransactionFilter = {}
  ): Promise<string> {
    const rows = await this.searchTransactions(actorRole, {
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

  async getEcoImpactSummary(
    actor: SafeUser,
    requestedScope: EcoScope = 'personal'
  ): Promise<EcoImpactSummary> {
    const effectiveScope: EcoScope = actor.account_type === 'admin' ? 'store' : requestedScope;
    const isPersonal = effectiveScope === 'personal';

    const whereClause = isPersonal ? 'WHERE t.account_id = ?' : '';
    const params = isPersonal ? [actor.account_id] : [];

    const agg = await this.db.queryOne<{
      paperless_count: number;
      total_paper_saved: number;
      total_carbon_reduction: number;
    }>(
      `SELECT
         COUNT(ei.impact_id) AS paperless_count,
         COALESCE(ROUND(SUM(CAST(ei.paper_saved AS DECIMAL(10, 2))), 2), 0) AS total_paper_saved,
         COALESCE(ROUND(SUM(CAST(ei.carbon_reduction AS DECIMAL(10, 2))), 2), 0) AS total_carbon_reduction
       FROM eco_impact ei
       INNER JOIN transactions t ON t.transaction_id = ei.transaction_id
       ${whereClause}`,
      params
    );

    const ledger = await this.db.queryAll<EcoImpactLedgerRow>(
      `SELECT
         t.transaction_id,
         t.transaction_date,
         dr.qr_code,
         a.full_name AS customer_name,
         CAST(t.total_amount AS DECIMAL(10, 2)) AS total_amount,
         CAST(ei.paper_saved AS DECIMAL(10, 2)) AS paper_saved,
         CAST(ei.carbon_reduction AS DECIMAL(10, 2)) AS carbon_reduction
       FROM eco_impact ei
       INNER JOIN transactions t ON t.transaction_id = ei.transaction_id
       INNER JOIN digital_receipts dr ON dr.transaction_id = t.transaction_id
       INNER JOIN accounts a ON a.account_id = t.account_id
       ${whereClause}
       ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      params
    );

    return {
      scope: effectiveScope,
      paperless_count: Number(agg?.paperless_count ?? 0),
      total_paper_saved: Number(agg?.total_paper_saved ?? 0),
      total_carbon_reduction: Number(agg?.total_carbon_reduction ?? 0),
      formula_note: ECO_IMPACT_SPEC.formula_note,
      specification: ECO_IMPACT_SPEC,
      ledger: ledger.map((r) => ({
        ...r,
        total_amount: Number(r.total_amount),
        paper_saved: Number(r.paper_saved),
        carbon_reduction: Number(r.carbon_reduction),
      })),
    };
  }

  async getDatabaseSnapshot(actor: SafeUser): Promise<DatabaseSnapshot> {
    if (actor.account_type !== 'admin') {
      throw new AppError(403, 'Administrator access required to inspect full database tables.');
    }

    const [
      accounts,
      products,
      inventory,
      transactions,
      transaction_details,
      digital_receipts,
      eco_impact,
    ] = await Promise.all([
      this.db.queryAll<SafeUser>(
        'SELECT account_id, username, account_type, full_name FROM accounts ORDER BY account_id ASC'
      ),
      this.db.queryAll<ProductRow>(
        'SELECT product_id, product_name, description, CAST(price AS DECIMAL(10, 2)) AS price, category, image_url, sku, is_archived FROM products ORDER BY product_id ASC'
      ),
      this.db.queryAll<InventoryRow>(
        'SELECT inventory_id, product_id, quantity, reorder_level, stock_status FROM inventory ORDER BY inventory_id ASC'
      ),
      this.db.queryAll<TransactionRow>(
        'SELECT transaction_id, account_id, transaction_date, CAST(total_amount AS DECIMAL(10, 2)) AS total_amount FROM transactions ORDER BY transaction_id ASC'
      ),
      this.db.queryAll<TransactionDetailRow>(
        'SELECT detail_id, transaction_id, product_id, quantity, CAST(subtotal AS DECIMAL(10, 2)) AS subtotal FROM transaction_details ORDER BY detail_id ASC'
      ),
      this.db.queryAll<DigitalReceiptRow>(
        'SELECT receipt_id, transaction_id, qr_code, receipt_date FROM digital_receipts ORDER BY receipt_id ASC'
      ),
      this.db.queryAll<EcoImpactRow>(
        'SELECT impact_id, transaction_id, CAST(paper_saved AS DECIMAL(10, 2)) AS paper_saved, CAST(carbon_reduction AS DECIMAL(10, 2)) AS carbon_reduction FROM eco_impact ORDER BY impact_id ASC'
      ),
    ]);

    return {
      accounts,
      products: products.map((p) => ({ ...p, price: Number(p.price) })),
      inventory,
      transactions: transactions.map((t) => ({ ...t, total_amount: Number(t.total_amount) })),
      transaction_details: transaction_details.map((d) => ({
        ...d,
        subtotal: Number(d.subtotal),
      })),
      digital_receipts,
      eco_impact: eco_impact.map((e) => ({
        ...e,
        paper_saved: Number(e.paper_saved),
        carbon_reduction: Number(e.carbon_reduction),
      })),
    };
  }
}

import {
  calculateEcoMetrics,
  deriveStockStatus,
  ECO_IMPACT_SPEC,
  sanitizeCsvCell,
  type AdminTransactionFilter,
  type AdminTransactionItem,
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
  type SaleLineInput,
  type TransactionDetailRow,
  type TransactionRow,
} from '../shared/types';

const DEMO_DB_KEY = 'greencart_demo_db_v1';
const DEMO_USER_KEY = 'greencart_demo_user_v1';

interface DemoAccount extends SafeUser {
  password: string;
}

interface DemoDbState {
  accounts: DemoAccount[];
  products: ProductRow[];
  inventory: InventoryRow[];
  transactions: TransactionRow[];
  transaction_details: TransactionDetailRow[];
  digital_receipts: DigitalReceiptRow[];
  eco_impact: EcoImpactRow[];
  inventory_adjustments: Array<{
    adjustment_id: number;
    product_id: number;
    account_id: number;
    delta: number;
    previous_qty: number;
    new_qty: number;
    reason: string;
    adjusted_at: string;
  }>;
  usedCheckoutTokens: string[];
}

function nowTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function generateReceiptToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `GC-${hex}`;
}

function createInitialDb(): DemoDbState {
  return {
    accounts: [
      { account_id: 1, username: 'maria_santos', account_type: 'customer', full_name: 'Maria Santos', password: 'customer123' },
      { account_id: 2, username: 'juan_delacruz', account_type: 'customer', full_name: 'Juan Dela Cruz', password: 'customer123' },
      { account_id: 3, username: 'walkin_customer', account_type: 'customer', full_name: 'Walk-In Customer (POS)', password: 'customer123' },
      { account_id: 4, username: 'admin_qcu', account_type: 'admin', full_name: 'Store Administrator', password: 'admin123' },
    ],
    products: [
      { product_id: 1, product_name: 'Bamboo Toothbrush 4-Pack', description: 'Biodegradable Moso bamboo handles with charcoal-infused soft bristles.', price: 145, category: 'Personal Care', image_url: '/images/products/product-1.svg', sku: 'ECO-101', is_archived: 0 },
      { product_id: 2, product_name: 'Organic Canvas Market Tote', description: 'Heavy-duty unbleached cotton shopping bag with reinforced stitched handles.', price: 220, category: 'Bags & Totes', image_url: '/images/products/product-2.svg', sku: 'ECO-102', is_archived: 0 },
      { product_id: 3, product_name: 'Insulated Stainless Tumbler 500ml', description: 'Double-wall vacuum flask that keeps drinks cold for 24 hours without single-use cups.', price: 480, category: 'Drinkware', image_url: '/images/products/product-3.svg', sku: 'ECO-103', is_archived: 0 },
      { product_id: 4, product_name: 'Beeswax Reusable Food Wraps (Set of 3)', description: 'Washable organic cotton wraps coated in local beeswax and tree resin.', price: 290, category: 'Kitchen & Home', image_url: '/images/products/product-4.svg', sku: 'ECO-104', is_archived: 0 },
      { product_id: 5, product_name: 'Refillable Amber Glass Soap Dispenser', description: '500ml UV-protected glass pump bottle designed for zero-waste refill stations.', price: 195, category: 'Personal Care', image_url: '/images/products/product-5.svg', sku: 'ECO-105', is_archived: 0 },
      { product_id: 6, product_name: 'Recycled Kraft Spiral Notebook', description: 'A5 dotted journal crafted from 100% post-consumer recycled paper.', price: 110, category: 'Stationery', image_url: '/images/products/product-6.svg', sku: 'ECO-106', is_archived: 0 },
      { product_id: 7, product_name: 'Natural Loofah Dish Scrubbers (3 pcs)', description: 'Compostable plant-fiber kitchen sponges that replace synthetic microplastic pads.', price: 95, category: 'Kitchen & Home', image_url: '/images/products/product-7.svg', sku: 'ECO-107', is_archived: 0 },
      { product_id: 8, product_name: 'Bamboo Utensil Travel Roll', description: 'Reusable fork, spoon, knife, chopsticks, and cleaning brush in a linen pouch.', price: 175, category: 'Kitchen & Home', image_url: '/images/products/product-8.svg', sku: 'ECO-108', is_archived: 0 },
    ],
    inventory: [
      { inventory_id: 1, product_id: 1, quantity: 34, reorder_level: 10, stock_status: 'In Stock' },
      { inventory_id: 2, product_id: 2, quantity: 18, reorder_level: 10, stock_status: 'In Stock' },
      { inventory_id: 3, product_id: 3, quantity: 8, reorder_level: 10, stock_status: 'Low Stock' },
      { inventory_id: 4, product_id: 4, quantity: 22, reorder_level: 10, stock_status: 'In Stock' },
      { inventory_id: 5, product_id: 5, quantity: 6, reorder_level: 10, stock_status: 'Low Stock' },
      { inventory_id: 6, product_id: 6, quantity: 45, reorder_level: 10, stock_status: 'In Stock' },
      { inventory_id: 7, product_id: 7, quantity: 0, reorder_level: 10, stock_status: 'Out of Stock' },
      { inventory_id: 8, product_id: 8, quantity: 27, reorder_level: 10, stock_status: 'In Stock' },
    ],
    transactions: [
      { transaction_id: 1001, account_id: 1, transaction_date: '2026-11-12 10:24:00', total_amount: 365 },
      { transaction_id: 1002, account_id: 1, transaction_date: '2026-11-16 15:42:00', total_amount: 590 },
      { transaction_id: 1003, account_id: 2, transaction_date: '2026-11-17 11:08:00', total_amount: 465 },
    ],
    transaction_details: [
      { detail_id: 1, transaction_id: 1001, product_id: 1, quantity: 1, subtotal: 145 },
      { detail_id: 2, transaction_id: 1001, product_id: 2, quantity: 1, subtotal: 220 },
      { detail_id: 3, transaction_id: 1002, product_id: 3, quantity: 1, subtotal: 480 },
      { detail_id: 4, transaction_id: 1002, product_id: 6, quantity: 1, subtotal: 110 },
      { detail_id: 5, transaction_id: 1003, product_id: 4, quantity: 1, subtotal: 290 },
      { detail_id: 6, transaction_id: 1003, product_id: 8, quantity: 1, subtotal: 175 },
    ],
    digital_receipts: [
      { receipt_id: 501, transaction_id: 1001, qr_code: 'GC-A491C82E10F4', receipt_date: '2026-11-12 10:24:00' },
      { receipt_id: 502, transaction_id: 1002, qr_code: 'GC-7D30B59E42A1', receipt_date: '2026-11-16 15:42:00' },
      { receipt_id: 503, transaction_id: 1003, qr_code: 'GC-9F28E14C66B9', receipt_date: '2026-11-17 11:08:00' },
    ],
    eco_impact: [
      { impact_id: 801, transaction_id: 1001, paper_saved: 1.5, carbon_reduction: 5.25 },
      { impact_id: 802, transaction_id: 1002, paper_saved: 1.5, carbon_reduction: 5.25 },
      { impact_id: 803, transaction_id: 1003, paper_saved: 1.5, carbon_reduction: 5.25 },
    ],
    inventory_adjustments: [
      { adjustment_id: 1, product_id: 7, account_id: 4, delta: -5, previous_qty: 5, new_qty: 0, reason: 'Damaged / expired', adjusted_at: '2026-11-16 09:15:00' },
      { adjustment_id: 2, product_id: 3, account_id: 4, delta: 8, previous_qty: 0, new_qty: 8, reason: 'Restock shipment', adjusted_at: '2026-11-17 08:30:00' },
    ],
    usedCheckoutTokens: [],
  };
}

let memoryFallbackDb: DemoDbState | null = null;
let memoryFallbackUserId: number | null = null;

function readDb(): DemoDbState {
  try {
    const raw = window.localStorage.getItem(DEMO_DB_KEY);
    if (raw) return JSON.parse(raw) as DemoDbState;
  } catch {
    if (memoryFallbackDb) return memoryFallbackDb;
  }
  const fresh = createInitialDb();
  writeDb(fresh);
  return fresh;
}

function writeDb(db: DemoDbState): void {
  memoryFallbackDb = db;
  try {
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota errors in restricted browsing modes
  }
}

function getSessionUserId(): number | null {
  try {
    const raw = window.localStorage.getItem(DEMO_USER_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return memoryFallbackUserId;
  }
}

function setSessionUserId(id: number | null): void {
  memoryFallbackUserId = id;
  try {
    if (id === null) window.localStorage.removeItem(DEMO_USER_KEY);
    else window.localStorage.setItem(DEMO_USER_KEY, String(id));
  } catch {
    // Ignore storage restriction
  }
}

function toSafeUser(acc: DemoAccount): SafeUser {
  return {
    account_id: acc.account_id,
    username: acc.username,
    account_type: acc.account_type,
    full_name: acc.full_name,
  };
}

function requireSessionUser(db: DemoDbState): DemoAccount {
  const uid = getSessionUserId();
  const user = uid ? db.accounts.find((a) => a.account_id === uid) : undefined;
  if (!user) throw new Error('Authentication required.');
  return user;
}

function toCatalogItem(p: ProductRow, inv: InventoryRow): CatalogItem {
  return {
    ...p,
    inventory_id: inv.inventory_id,
    quantity: inv.quantity,
    reorder_level: inv.reorder_level,
    stock_status: inv.stock_status,
  };
}

function buildReceiptView(db: DemoDbState, transactionId: number): DigitalReceiptView {
  const tx = db.transactions.find((t) => t.transaction_id === transactionId);
  const receipt = db.digital_receipts.find((r) => r.transaction_id === transactionId);
  const eco = db.eco_impact.find((e) => e.transaction_id === transactionId);
  const acc = tx ? db.accounts.find((a) => a.account_id === tx.account_id) : undefined;
  if (!tx || !receipt || !eco || !acc) throw new Error('Receipt not found.');

  const items: ReceiptLineItemView[] = db.transaction_details
    .filter((d) => d.transaction_id === transactionId)
    .map((d) => {
      const prod = db.products.find((p) => p.product_id === d.product_id);
      return {
        detail_id: d.detail_id,
        product_id: d.product_id,
        product_name: prod?.product_name ?? `Product #${d.product_id}`,
        quantity: d.quantity,
        unit_price: prod?.price ?? 0,
        subtotal: d.subtotal,
      };
    });

  return {
    receipt_id: receipt.receipt_id,
    transaction_id: tx.transaction_id,
    qr_code: receipt.qr_code,
    receipt_date: receipt.receipt_date,
    transaction_date: tx.transaction_date,
    total_amount: tx.total_amount,
    customer_account_id: acc.account_id,
    customer_name: acc.full_name,
    customer_username: acc.username,
    paper_saved: eco.paper_saved,
    carbon_reduction: eco.carbon_reduction,
    items,
  };
}

function filterTransactions(db: DemoDbState, filters: AdminTransactionFilter): AdminTransactionItem[] {
  const q = filters.search?.trim().toLowerCase() ?? '';
  const rows: AdminTransactionItem[] = db.transactions.map((tx) => {
    const acc = db.accounts.find((a) => a.account_id === tx.account_id)!;
    const receipt = db.digital_receipts.find((r) => r.transaction_id === tx.transaction_id)!;
    const eco = db.eco_impact.find((e) => e.transaction_id === tx.transaction_id)!;
    const details = db.transaction_details.filter((d) => d.transaction_id === tx.transaction_id);
    return {
      transaction_id: tx.transaction_id,
      account_id: tx.account_id,
      customer_username: acc.username,
      customer_name: acc.full_name,
      transaction_date: tx.transaction_date,
      total_amount: tx.total_amount,
      qr_code: receipt.qr_code,
      receipt_date: receipt.receipt_date,
      item_count: details.length,
      total_units: details.reduce((sum, d) => sum + d.quantity, 0),
      paper_saved: eco.paper_saved,
      carbon_reduction: eco.carbon_reduction,
    };
  });

  const filtered = rows.filter((r) => {
    if (q) {
      const hit =
        String(r.transaction_id).includes(q) ||
        r.qr_code.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.customer_username.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filters.customerAccountId && r.account_id !== filters.customerAccountId) return false;
    const day = r.transaction_date.slice(0, 10);
    if (filters.dateFrom && day < filters.dateFrom) return false;
    if (filters.dateTo && day > filters.dateTo) return false;
    return true;
  });

  const sort = filters.sort ?? 'newest';
  filtered.sort((a, b) => {
    if (sort === 'oldest') return a.transaction_id - b.transaction_id;
    if (sort === 'highest') return b.total_amount - a.total_amount || b.transaction_id - a.transaction_id;
    if (sort === 'lowest') return a.total_amount - b.total_amount || b.transaction_id - a.transaction_id;
    return b.transaction_id - a.transaction_id;
  });
  return filtered.slice(0, filters.limit ?? 200);
}

export const demoApi = {
  async me(): Promise<{ user: SafeUser | null; csrfToken: string | null }> {
    const db = readDb();
    const uid = getSessionUserId();
    const user = uid ? db.accounts.find((a) => a.account_id === uid) : undefined;
    return { user: user ? toSafeUser(user) : null, csrfToken: user ? 'demo-csrf' : null };
  },

  async login(username: string, password: string): Promise<{ user: SafeUser; csrfToken: string }> {
    const db = readDb();
    const norm = username.trim().toLowerCase();
    const found = db.accounts.find((a) => a.username.toLowerCase() === norm && a.password === password);
    if (!found) throw new Error('Invalid username or password.');
    setSessionUserId(found.account_id);
    return { user: toSafeUser(found), csrfToken: 'demo-csrf' };
  },

  async register(payload: {
    username: string;
    password: string;
    full_name: string;
  }): Promise<{ user: SafeUser; csrfToken: string }> {
    const db = readDb();
    const username = payload.username.trim().toLowerCase();
    const fullName = payload.full_name.trim();
    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      throw new Error('Username must be 3-32 lowercase letters, numbers, or underscores.');
    }
    if (fullName.length < 2 || fullName.length > 80) {
      throw new Error('Full name must be between 2 and 80 characters.');
    }
    if (payload.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (db.accounts.some((a) => a.username.toLowerCase() === username)) {
      throw new Error('Username is already registered.');
    }
    const nextId = Math.max(0, ...db.accounts.map((a) => a.account_id)) + 1;
    const acc: DemoAccount = {
      account_id: nextId,
      username,
      account_type: 'customer',
      full_name: fullName,
      password: payload.password,
    };
    db.accounts.push(acc);
    writeDb(db);
    setSessionUserId(acc.account_id);
    return { user: toSafeUser(acc), csrfToken: 'demo-csrf' };
  },

  async logout(): Promise<void> {
    setSessionUserId(null);
  },

  async updateProfile(full_name: string): Promise<{ user: SafeUser; csrfToken: string }> {
    const db = readDb();
    const actor = requireSessionUser(db);
    const trimmed = full_name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new Error('Full name must be between 2 and 80 characters.');
    }
    actor.full_name = trimmed;
    writeDb(db);
    return { user: toSafeUser(actor), csrfToken: 'demo-csrf' };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.password !== currentPassword) throw new Error('Current password is incorrect.');
    if (newPassword.length < 6 || newPassword.length > 128) {
      throw new Error('New password must be between 6 and 128 characters.');
    }
    actor.password = newPassword;
    writeDb(db);
  },

  async getCatalog(search = '', status = 'ALL', category = 'ALL', includeArchived = false): Promise<CatalogItem[]> {
    const db = readDb();
    const actor = requireSessionUser(db);
    const showArchived = actor.account_type === 'admin' && includeArchived;
    const q = search.trim().toLowerCase();

    return db.products
      .map((p) => {
        const inv = db.inventory.find((i) => i.product_id === p.product_id)!;
        return toCatalogItem(p, inv);
      })
      .filter((item) => {
        if (!showArchived && item.is_archived) return false;
        if (
          q &&
          !item.product_name.toLowerCase().includes(q) &&
          !item.description.toLowerCase().includes(q) &&
          !(item.sku || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        if (status !== 'ALL' && item.stock_status !== status) return false;
        if (category !== 'ALL' && item.category !== category) return false;
        return true;
      });
  },

  async getCustomers(): Promise<SafeUser[]> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    return db.accounts
      .filter((a) => a.account_type === 'customer')
      .map(toSafeUser)
      .sort((a, b) =>
        a.username === 'walkin_customer'
          ? -1
          : b.username === 'walkin_customer'
            ? 1
            : a.full_name.localeCompare(b.full_name)
      );
  },

  async uploadProductImage(file: File): Promise<{ image_url: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
    return { image_url: dataUrl };
  },

  async createProduct(payload: {
    product_name: string;
    description: string;
    price: number;
    quantity: number;
    reorder_level?: number;
    category?: string;
    image_url?: string | null;
    sku?: string | null;
  }): Promise<CatalogItem> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Only administrators can add products.');
    const sku = payload.sku ? payload.sku.trim().toUpperCase() : null;
    if (sku && db.products.some((p) => p.sku?.toUpperCase() === sku)) {
      throw new Error('SKU/barcode is already assigned to another product.');
    }
    const productId = Math.max(0, ...db.products.map((p) => p.product_id)) + 1;
    const invId = Math.max(0, ...db.inventory.map((i) => i.inventory_id)) + 1;
    const reorderLevel = payload.reorder_level ?? 10;
    const prod: ProductRow = {
      product_id: productId,
      product_name: payload.product_name.trim(),
      description: payload.description.trim(),
      price: Number(Number(payload.price).toFixed(2)),
      category: (payload.category || 'Kitchen & Home').trim(),
      image_url: payload.image_url || null,
      sku,
      is_archived: 0,
    };
    const inv: InventoryRow = {
      inventory_id: invId,
      product_id: productId,
      quantity: payload.quantity,
      reorder_level: reorderLevel,
      stock_status: deriveStockStatus(payload.quantity, reorderLevel),
    };
    db.products.push(prod);
    db.inventory.push(inv);
    if (payload.quantity > 0) {
      db.inventory_adjustments.push({
        adjustment_id: Math.max(0, ...db.inventory_adjustments.map((a) => a.adjustment_id)) + 1,
        product_id: productId,
        account_id: actor.account_id,
        delta: payload.quantity,
        previous_qty: 0,
        new_qty: payload.quantity,
        reason: 'Initial stock entry',
        adjusted_at: nowTimestamp(),
      });
    }
    writeDb(db);
    return toCatalogItem(prod, inv);
  },

  async updateProduct(
    productId: number,
    payload: {
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
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Only administrators can edit products.');
    const prod = db.products.find((p) => p.product_id === productId);
    const inv = db.inventory.find((i) => i.product_id === productId);
    if (!prod || !inv) throw new Error('Product not found.');

    const sku = payload.sku === undefined ? prod.sku : payload.sku ? payload.sku.trim().toUpperCase() : null;
    if (sku && db.products.some((p) => p.product_id !== productId && p.sku?.toUpperCase() === sku)) {
      throw new Error('SKU/barcode is already assigned to another product.');
    }

    const prevQty = inv.quantity;
    prod.product_name = payload.product_name.trim();
    prod.description = payload.description.trim();
    prod.price = Number(Number(payload.price).toFixed(2));
    prod.category = (payload.category ?? prod.category).trim();
    if (payload.image_url !== undefined) prod.image_url = payload.image_url;
    prod.sku = sku;
    if (payload.is_archived !== undefined) prod.is_archived = payload.is_archived ? 1 : 0;

    inv.quantity = payload.quantity;
    inv.reorder_level = payload.reorder_level ?? inv.reorder_level;
    inv.stock_status = deriveStockStatus(inv.quantity, inv.reorder_level);

    if (inv.quantity !== prevQty) {
      db.inventory_adjustments.push({
        adjustment_id: Math.max(0, ...db.inventory_adjustments.map((a) => a.adjustment_id)) + 1,
        product_id: productId,
        account_id: actor.account_id,
        delta: inv.quantity - prevQty,
        previous_qty: prevQty,
        new_qty: inv.quantity,
        reason: payload.adjustment_reason || 'Inventory count update',
        adjusted_at: nowTimestamp(),
      });
    }
    writeDb(db);
    return toCatalogItem(prod, inv);
  },

  async setProductArchived(productId: number, isArchived: boolean): Promise<CatalogItem> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Only administrators can archive products.');
    const prod = db.products.find((p) => p.product_id === productId);
    const inv = db.inventory.find((i) => i.product_id === productId);
    if (!prod || !inv) throw new Error('Product not found.');
    prod.is_archived = isArchived ? 1 : 0;
    writeDb(db);
    return toCatalogItem(prod, inv);
  },

  async adjustStock(productId: number, delta: number, reason = 'Quick stock adjustment'): Promise<CatalogItem> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Only administrators can adjust stock.');
    const prod = db.products.find((p) => p.product_id === productId);
    const inv = db.inventory.find((i) => i.product_id === productId);
    if (!prod || !inv) throw new Error('Product inventory record not found.');
    const nextQty = inv.quantity + delta;
    if (nextQty < 0) throw new Error('Stock quantity cannot become negative.');

    const prevQty = inv.quantity;
    inv.quantity = nextQty;
    inv.stock_status = deriveStockStatus(nextQty, inv.reorder_level);
    db.inventory_adjustments.push({
      adjustment_id: Math.max(0, ...db.inventory_adjustments.map((a) => a.adjustment_id)) + 1,
      product_id: productId,
      account_id: actor.account_id,
      delta,
      previous_qty: prevQty,
      new_qty: nextQty,
      reason,
      adjusted_at: nowTimestamp(),
    });
    writeDb(db);
    return toCatalogItem(prod, inv);
  },

  async getInventoryAdjustments(productId?: number, limit = 100): Promise<InventoryAdjustmentView[]> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    return [...db.inventory_adjustments]
      .filter((entry) => !productId || entry.product_id === productId)
      .sort((a, b) => b.adjustment_id - a.adjustment_id)
      .slice(0, limit)
      .map((entry) => {
        const prod = db.products.find((p) => p.product_id === entry.product_id);
        const user = db.accounts.find((a) => a.account_id === entry.account_id);
        return {
          ...entry,
          product_name: prod?.product_name ?? `Product #${entry.product_id}`,
          sku: prod?.sku ?? null,
          actor_name: user?.full_name ?? 'Admin',
        };
      });
  },

  async processSale(payload: {
    account_id?: number;
    lineItems: SaleLineInput[];
    checkoutToken: string;
  }): Promise<DigitalReceiptView> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (db.usedCheckoutTokens.includes(payload.checkoutToken)) {
      throw new Error('Duplicate sale submission blocked.');
    }
    const targetAccountId =
      actor.account_type === 'admin' && payload.account_id ? payload.account_id : actor.account_id;

    const merged = new Map<number, number>();
    for (const line of payload.lineItems) {
      merged.set(line.product_id, (merged.get(line.product_id) ?? 0) + line.quantity);
    }

    let totalCents = 0;
    const prepared: Array<{ prod: ProductRow; inv: InventoryRow; qty: number; subtotal: number }> = [];
    for (const [productId, qty] of merged.entries()) {
      const prod = db.products.find((p) => p.product_id === productId);
      const inv = db.inventory.find((i) => i.product_id === productId);
      if (!prod || !inv) throw new Error(`Product #${productId} does not exist.`);
      if (prod.is_archived) throw new Error(`"${prod.product_name}" is archived and no longer available for sale.`);
      if (inv.quantity < qty) throw new Error(`Insufficient stock for "${prod.product_name}".`);
      const lineCents = Math.round(prod.price * 100) * qty;
      totalCents += lineCents;
      prepared.push({ prod, inv, qty, subtotal: Number((lineCents / 100).toFixed(2)) });
    }

    const txId = Math.max(1000, ...db.transactions.map((t) => t.transaction_id)) + 1;
    const timestamp = nowTimestamp();
    db.transactions.push({
      transaction_id: txId,
      account_id: targetAccountId,
      transaction_date: timestamp,
      total_amount: Number((totalCents / 100).toFixed(2)),
    });

    let detailId = Math.max(0, ...db.transaction_details.map((d) => d.detail_id));
    for (const line of prepared) {
      detailId += 1;
      db.transaction_details.push({
        detail_id: detailId,
        transaction_id: txId,
        product_id: line.prod.product_id,
        quantity: line.qty,
        subtotal: line.subtotal,
      });
      line.inv.quantity -= line.qty;
      line.inv.stock_status = deriveStockStatus(line.inv.quantity, line.inv.reorder_level);
    }

    const receiptId = Math.max(500, ...db.digital_receipts.map((r) => r.receipt_id)) + 1;
    db.digital_receipts.push({
      receipt_id: receiptId,
      transaction_id: txId,
      qr_code: generateReceiptToken(),
      receipt_date: timestamp,
    });

    const ecoMetrics = calculateEcoMetrics(prepared.length);
    const impactId = Math.max(800, ...db.eco_impact.map((e) => e.impact_id)) + 1;
    db.eco_impact.push({
      impact_id: impactId,
      transaction_id: txId,
      paper_saved: ecoMetrics.paper_saved,
      carbon_reduction: ecoMetrics.carbon_reduction,
    });
    db.usedCheckoutTokens.push(payload.checkoutToken);
    writeDb(db);
    return buildReceiptView(db, txId);
  },

  async getReceiptByToken(qrCode: string): Promise<DigitalReceiptView> {
    const db = readDb();
    const actor = requireSessionUser(db);
    const receipt = db.digital_receipts.find(
      (r) => r.qr_code.toUpperCase() === qrCode.trim().toUpperCase()
    );
    if (!receipt) throw new Error('No digital receipt matched that QR token.');
    const view = buildReceiptView(db, receipt.transaction_id);
    if (
      actor.account_type === 'customer' &&
      view.customer_account_id !== actor.account_id &&
      view.customer_username !== 'walkin_customer'
    ) {
      throw new Error('Access denied: this receipt belongs to another customer.');
    }
    return view;
  },

  async getReceiptByTransactionId(transactionId: number): Promise<DigitalReceiptView> {
    const db = readDb();
    const actor = requireSessionUser(db);
    const view = buildReceiptView(db, transactionId);
    if (actor.account_type === 'customer' && view.customer_account_id !== actor.account_id) {
      throw new Error('Access denied: cannot view another customer’s private receipt.');
    }
    return view;
  },

  async getHistory(): Promise<PurchaseHistoryItem[]> {
    const db = readDb();
    const actor = requireSessionUser(db);
    return db.transactions
      .filter((t) => t.account_id === actor.account_id)
      .sort((a, b) => b.transaction_id - a.transaction_id)
      .map((t) => {
        const dr = db.digital_receipts.find((r) => r.transaction_id === t.transaction_id)!;
        const eco = db.eco_impact.find((e) => e.transaction_id === t.transaction_id)!;
        const lines = db.transaction_details.filter((d) => d.transaction_id === t.transaction_id);
        return {
          transaction_id: t.transaction_id,
          transaction_date: t.transaction_date,
          total_amount: t.total_amount,
          qr_code: dr.qr_code,
          receipt_date: dr.receipt_date,
          item_count: lines.length,
          total_units: lines.reduce((sum, l) => sum + l.quantity, 0),
          paper_saved: eco.paper_saved,
          carbon_reduction: eco.carbon_reduction,
        };
      });
  },

  async getAdminTransactions(filters: AdminTransactionFilter = {}): Promise<AdminTransactionItem[]> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    return filterTransactions(db, filters);
  },

  downloadTransactionsCsv(filters: AdminTransactionFilter = {}): void {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    const rows = filterTransactions(db, { ...filters, limit: 500 });
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
    const csv = [
      header,
      ...rows.map((r) =>
        [
          r.transaction_id,
          r.transaction_date,
          r.customer_username,
          r.customer_name,
          r.qr_code,
          r.item_count,
          r.total_units,
          r.total_amount.toFixed(2),
          r.paper_saved.toFixed(2),
          r.carbon_reduction.toFixed(2),
        ]
          .map(sanitizeCsvCell)
          .join(',')
      ),
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'greencart-transactions.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async getEcoImpact(scope: EcoScope): Promise<EcoImpactSummary> {
    const db = readDb();
    const actor = requireSessionUser(db);
    const effectiveScope: EcoScope = actor.account_type === 'admin' ? 'store' : scope;
    const txs = db.transactions
      .filter((t) => effectiveScope === 'store' || t.account_id === actor.account_id)
      .sort((a, b) => b.transaction_id - a.transaction_id);

    const ledger: EcoImpactLedgerRow[] = txs.map((t) => {
      const dr = db.digital_receipts.find((r) => r.transaction_id === t.transaction_id)!;
      const acc = db.accounts.find((a) => a.account_id === t.account_id)!;
      const eco = db.eco_impact.find((e) => e.transaction_id === t.transaction_id)!;
      return {
        transaction_id: t.transaction_id,
        transaction_date: t.transaction_date,
        qr_code: dr.qr_code,
        customer_name: acc.full_name,
        total_amount: t.total_amount,
        paper_saved: eco.paper_saved,
        carbon_reduction: eco.carbon_reduction,
      };
    });

    return {
      scope: effectiveScope,
      paperless_count: ledger.length,
      total_paper_saved: Number(ledger.reduce((s, r) => s + r.paper_saved, 0).toFixed(2)),
      total_carbon_reduction: Number(ledger.reduce((s, r) => s + r.carbon_reduction, 0).toFixed(2)),
      formula_note: ECO_IMPACT_SPEC.formula_note,
      specification: ECO_IMPACT_SPEC,
      ledger,
    };
  },

  async getDbSnapshot(): Promise<DatabaseSnapshot> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    return {
      accounts: db.accounts.map(toSafeUser),
      products: db.products,
      inventory: db.inventory,
      transactions: db.transactions,
      transaction_details: db.transaction_details,
      digital_receipts: db.digital_receipts,
      eco_impact: db.eco_impact,
    };
  },

  async resetDb(): Promise<void> {
    const db = readDb();
    const actor = requireSessionUser(db);
    if (actor.account_type !== 'admin') throw new Error('Administrator access required.');
    writeDb(createInitialDb());
  },
};

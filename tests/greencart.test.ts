import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import QRCode from 'qrcode';
import { openDatabase } from '../src/server/db.ts';
import { signSessionToken, verifySessionToken } from '../src/server/crypto.ts';
import { AppError, GreenCartService } from '../src/server/service.ts';
import { createApiMiddleware } from '../src/server/apiPlugin.ts';
import { ECO_IMPACT_SPEC, calculateEcoMetrics } from '../src/shared/types.ts';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Record<string, unknown>;
}

async function invokeMiddleware(
  middleware: ReturnType<typeof createApiMiddleware>,
  options: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<MockResponseResult> {
  const req = new PassThrough() as unknown as PassThrough &
    IncomingMessage & {
      method: string;
      url: string;
      headers: Record<string, string>;
    };
  req.method = options.method;
  req.url = options.url;
  req.headers = { ...(options.headers ?? {}) };

  const rawHeaders: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      rawHeaders[name.toLowerCase()] = value;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      resolveDone();
    },
  } as unknown as ServerResponse;

  middleware(req, res, () => resolveDone());

  if (options.body !== undefined) {
    req.end(Buffer.from(JSON.stringify(options.body), 'utf8'));
  } else {
    req.end();
  }

  await donePromise;
  const rawText = Buffer.concat(chunks).toString('utf8');
  return {
    statusCode: res.statusCode,
    headers: rawHeaders,
    body: rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {},
  };
}

describe('GreenCart Minimum Test Matrix & 7-Entity Integrity', () => {
  let db: DatabaseSync;
  let service: GreenCartService;

  beforeEach(() => {
    db = openDatabase(':memory:');
    service = new GreenCartService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('registers a customer with a salted scrypt hash and blocks admin self-registration', async () => {
    const created = await service.registerCustomer({
      username: 'elena_reyes',
      password: 'Password123',
      full_name: 'Elena Reyes',
    });

    expect(created.account_type).toBe('customer');
    expect(created.username).toBe('elena_reyes');

    const stored = db
      .prepare('SELECT password_hash, account_type FROM accounts WHERE account_id = ?')
      .get(created.account_id) as { password_hash: string; account_type: string };
    expect(stored.password_hash.startsWith('scrypt$')).toBe(true);
    expect(stored.password_hash).not.toContain('Password123');
    expect(stored.account_type).toBe('customer');

    await expect(
      service.registerCustomer({
        username: 'fake_admin',
        password: 'Password123',
        full_name: 'Fake Admin',
        account_type: 'admin',
      })
    ).rejects.toThrowError(AppError);
  });

  it('rejects bad passwords and enforces role guards on admin operations', async () => {
    await expect(service.login('maria_santos', 'wrong-pass')).rejects.toThrowError(
      /Invalid username or password/
    );

    const maria = await service.login('maria_santos', 'customer123');
    expect(maria.account_type).toBe('customer');

    await expect(
      service.upsertProduct(maria.account_type, {
        product_name: 'Unauthorized Item',
        description: 'Should fail',
        price: 99,
        quantity: 10,
      })
    ).rejects.toThrowError(/Only administrators/);

    await expect(service.adjustStock(maria.account_type, 1, 5)).rejects.toThrowError(
      /Only administrators/
    );
    await expect(service.getDatabaseSnapshot(maria)).rejects.toThrowError(
      /Administrator access required/
    );
  });

  it('searches catalog, synchronizes stock_status, and rejects negative stock', async () => {
    const bamboo = await service.listCatalog('bamboo');
    expect(bamboo.length).toBe(2);

    const admin = await service.login('admin_qcu', 'admin123');
    // Product 1 starts at 34 ('In Stock'); adjust by -26 -> 8 ('Low Stock')
    const low = await service.adjustStock(admin.account_type, 1, -26);
    expect(low.quantity).toBe(8);
    expect(low.stock_status).toBe('Low Stock');

    // Adjust to 0 -> 'Out of Stock'
    const zero = await service.adjustStock(admin.account_type, 1, -8);
    expect(zero.quantity).toBe(0);
    expect(zero.stock_status).toBe('Out of Stock');

    // Negative stock rejected
    await expect(service.adjustStock(admin.account_type, 1, -1)).rejects.toThrowError(
      /cannot become negative/
    );
  });

  it('ignores client-tampered prices/totals and deducts stock atomically across Customer & POS sales', async () => {
    const maria = await service.login('maria_santos', 'customer123');
    const admin = await service.login('admin_qcu', 'admin123');

    // Product 1 is 145.00 (qty 34), Product 2 is 220.00 (qty 18)
    // Tamper client payload with bogus prices and total_amount = 1.00
    const customerReceipt = await service.processSale(maria, {
      checkoutToken: 'tok-customer-1',
      total_amount: 1.0,
      lineItems: [
        { product_id: 1, quantity: 2, price: 0.01, subtotal: 0.02 },
        { product_id: 2, quantity: 1, price: 0.01, subtotal: 0.01 },
      ],
    });

    expect(customerReceipt.total_amount).toBe(510.0); // (145 * 2) + 220
    expect(customerReceipt.qr_code).toMatch(/^GC-[A-F0-9]{32}$/);
    expect(customerReceipt.paper_saved).toBe(1.5); // 1.0 + 2 * 0.25
    expect(customerReceipt.carbon_reduction).toBe(5.25); // 1.5 * 3.5

    // Admin POS sale assigned to walkin_customer (account_id 3)
    const posReceipt = await service.processSale(admin, {
      account_id: 3,
      checkoutToken: 'tok-pos-1',
      lineItems: [{ product_id: 1, quantity: 3 }],
    });

    expect(posReceipt.customer_username).toBe('walkin_customer');
    expect(posReceipt.total_amount).toBe(435.0);

    const invRow = db
      .prepare('SELECT quantity FROM inventory WHERE product_id = 1')
      .get() as { quantity: number };
    expect(invRow.quantity).toBe(29); // 34 - 2 - 3
  });

  it('rolls back entire transaction on insufficient stock, mid-sale failure, and blocks duplicate submissions', async () => {
    const maria = await service.login('maria_santos', 'customer123');
    const beforeTxCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get() as { cnt: number }
    ).cnt;

    // Product 7 has 0 stock
    await expect(
      service.processSale(maria, {
        checkoutToken: 'tok-fail-stock',
        lineItems: [
          { product_id: 1, quantity: 1 },
          { product_id: 7, quantity: 1 },
        ],
      })
    ).rejects.toThrowError(/Insufficient stock/);

    // Mid-transaction failure hook after inserts
    await expect(
      service.processSale(
        maria,
        {
          checkoutToken: 'tok-fail-mid',
          lineItems: [{ product_id: 1, quantity: 2 }],
        },
        () => {
          throw new Error('Simulated crash before commit');
        }
      )
    ).rejects.toThrowError('Simulated crash before commit');

    const afterTxCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get() as { cnt: number }
    ).cnt;
    const prod1Stock = (
      db.prepare('SELECT quantity FROM inventory WHERE product_id = 1').get() as { quantity: number }
    ).quantity;

    expect(afterTxCount).toBe(beforeTxCount);
    expect(prod1Stock).toBe(34); // completely untouched

    // Duplicate checkoutToken protection
    await service.processSale(maria, {
      checkoutToken: 'tok-once',
      lineItems: [{ product_id: 1, quantity: 1 }],
    });
    await expect(
      service.processSale(maria, {
        checkoutToken: 'tok-once',
        lineItems: [{ product_id: 1, quantity: 1 }],
      })
    ).rejects.toThrowError(/Duplicate sale submission blocked/);
  });

  it('enforces receipt lookup, local QR generation, cross-customer ownership, and Eco-Impact reconciliation', async () => {
    const maria = await service.login('maria_santos', 'customer123');
    const juan = await service.login('juan_delacruz', 'customer123');

    // Valid token lookup & local QR image generation
    const mariaReceipt = await service.getReceiptByToken('GC-7D30B59E42A1', maria);
    expect(mariaReceipt.transaction_id).toBe(1002);
    const qrDataUrl = await QRCode.toDataURL(`https://greencart.local/?receipt=${mariaReceipt.qr_code}`);
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // Invalid token discloses nothing
    await expect(service.getReceiptByToken('GC-DEADBEEF0000', maria)).rejects.toThrowError(
      /No digital receipt/
    );

    // Customer A (Maria) cannot access Customer B (Juan)'s history or private receipt
    await expect(service.getCustomerHistory(maria, juan.account_id)).rejects.toThrowError(
      /Access denied/
    );
    await expect(service.getReceiptByTransactionId(1003, maria)).rejects.toThrowError(
      /Access denied/
    );
    await expect(service.getReceiptByToken('GC-9F28E14C66B9', maria)).rejects.toThrowError(
      /Access denied/
    );

    // Eco-Impact reconciliation against DB aggregates
    const personalSummary = await service.getEcoImpactSummary(maria, 'personal');
    const dbPersonal = db
      .prepare(
        `SELECT COUNT(*) AS cnt, SUM(paper_saved) AS paper, SUM(carbon_reduction) AS carbon
         FROM eco_impact ei
         INNER JOIN transactions t ON t.transaction_id = ei.transaction_id
         WHERE t.account_id = ?`
      )
      .get(maria.account_id) as { cnt: number; paper: number; carbon: number };

    expect(personalSummary.paperless_count).toBe(dbPersonal.cnt);
    expect(personalSummary.total_paper_saved).toBe(Number(dbPersonal.paper.toFixed(2)));
    expect(personalSummary.total_carbon_reduction).toBe(Number(dbPersonal.carbon.toFixed(2)));
  });

  it('rejects unauthenticated and missing-CSRF state changes in HTTP middleware', async () => {
    const middleware = createApiMiddleware(db, 'test-secret');

    const unauthRes = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/catalog',
    });
    expect(unauthRes.statusCode).toBe(401);

    const loginRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'maria_santos', password: 'customer123' },
    });
    expect(loginRes.statusCode).toBe(200);
    const setCookies = loginRes.headers['set-cookie'] as string[];
    const sessionCookie = setCookies.find((c) => c.startsWith('gc_session='))!.split(';')[0];
    const csrfToken = String(loginRes.body.csrfToken);

    // Missing CSRF token on POST /api/sales must be rejected (403)
    const noCsrfRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/sales',
      headers: { cookie: sessionCookie },
      body: {
        checkoutToken: 'http-no-csrf',
        lineItems: [{ product_id: 1, quantity: 1 }],
      },
    });
    expect(noCsrfRes.statusCode).toBe(403);

    // Valid CSRF token succeeds (201)
    const okSaleRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/sales',
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      body: {
        checkoutToken: 'http-valid-csrf',
        lineItems: [{ product_id: 1, quantity: 1 }],
      },
    });
    expect(okSaleRes.statusCode).toBe(201);
  });

  it('rejects expired signed session tokens', async () => {
    const maria = await service.login('maria_santos', 'customer123');
    const validToken = signSessionToken(maria, 'unit-secret', 60_000);
    expect(verifySessionToken(validToken, 'unit-secret')?.username).toBe('maria_santos');

    const expiredToken = signSessionToken(maria, 'unit-secret', -1000);
    expect(verifySessionToken(expiredToken, 'unit-secret')).toBeNull();
  });

  it('refreshes rolling session and CSRF cookies on GET /api/auth/me', async () => {
    const middleware = createApiMiddleware(db, 'rolling-secret');
    const loginRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'maria_santos', password: 'customer123' },
    });
    const sessionCookie = (loginRes.headers['set-cookie'] as string[])
      .find((c) => c.startsWith('gc_session='))!
      .split(';')[0];

    const meRes = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie },
    });
    expect(meRes.statusCode).toBe(200);
    const refreshedCookies = meRes.headers['set-cookie'] as string[];
    expect(refreshedCookies.some((c) => c.startsWith('gc_session='))).toBe(true);
    expect(refreshedCookies.some((c) => c.startsWith('gc_csrf='))).toBe(true);
  });

  it('supports Phase 1 category filtering, product image metadata, and safe admin image uploads', async () => {
    const maria = await service.login('maria_santos', 'customer123');
    const admin = await service.login('admin_qcu', 'admin123');

    const drinkware = await service.listCatalog('', 'ALL', 'Drinkware');
    expect(drinkware.length).toBe(1);
    expect(drinkware[0].product_name).toContain('Tumbler');
    expect(drinkware[0].image_url).toBe('/images/products/product-3.svg');

    // Non-admin upload blocked
    const tinyPngB64 = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
      'hex'
    ).toString('base64');

    expect(() =>
      service.saveProductImageUpload(maria.account_type, {
        filename: 'test.png',
        mimeType: 'image/png',
        base64Data: tinyPngB64,
      })
    ).toThrowError(/Only administrators/);

    // Invalid MIME rejected
    expect(() =>
      service.saveProductImageUpload(admin.account_type, {
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        base64Data: tinyPngB64,
      })
    ).toThrowError(/Unsupported image format/);

    // Oversized (>2MB) rejected
    const oversizedB64 = Buffer.alloc(2 * 1024 * 1024 + 8, 1).toString('base64');
    expect(() =>
      service.saveProductImageUpload(admin.account_type, {
        filename: 'huge.png',
        mimeType: 'image/png',
        base64Data: oversizedB64,
      })
    ).toThrowError(/2 MB/);

    // Valid PNG upload succeeds and attaches to new product
    const uploaded = service.saveProductImageUpload(admin.account_type, {
      filename: 'straw.png',
      mimeType: 'image/png',
      base64Data: tinyPngB64,
    });
    expect(uploaded.image_url).toMatch(/^\/uploads\/products\/.+\.png$/);

    try {
      const created = await service.upsertProduct(admin.account_type, {
        product_name: 'Stainless Straw Kit',
        description: 'Reusable metal straws with cleaning brush.',
        price: 120,
        quantity: 14,
        category: 'Drinkware',
        image_url: uploaded.image_url,
      });
      expect(created.category).toBe('Drinkware');
      expect(created.image_url).toBe(uploaded.image_url);
      expect((await service.listCatalog('', 'ALL', 'Drinkware')).length).toBe(2);
    } finally {
      const diskPath = path.join(process.cwd(), 'public', uploaded.image_url);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
  });

  it('supports Phase 2 optional unique SKUs, SKU search, and duplicate SKU rejection', async () => {
    const admin = await service.login('admin_qcu', 'admin123');
    const bySku = await service.listCatalog('ECO-103');
    expect(bySku.length).toBe(1);
    expect(bySku[0].sku).toBe('ECO-103');

    const created = await service.upsertProduct(admin.account_type, {
      product_name: 'Compostable Produce Bags',
      description: 'Roll of 50 plant-starch produce bags.',
      price: 160,
      quantity: 20,
      category: 'Bags & Totes',
      sku: 'eco-109',
    });
    expect(created.sku).toBe('ECO-109');

    // Duplicate SKU rejected with 409
    await expect(
      service.upsertProduct(admin.account_type, {
        product_name: 'Duplicate SKU Item',
        description: 'Should fail on duplicate SKU.',
        price: 50,
        quantity: 5,
        sku: 'ECO-109',
      })
    ).rejects.toThrowError(/already assigned/);
  });

  it('supports Phase 3 per-product reorder thresholds and adjustment audit logs', async () => {
    const admin = await service.login('admin_qcu', 'admin123');
    const maria = await service.login('maria_santos', 'customer123');

    const created = await service.upsertProduct(admin, {
      product_name: 'Refillable Dish Soap Pouch',
      description: 'Concentrated botanical dishwashing refill.',
      price: 150,
      quantity: 5,
      reorder_level: 3,
      category: 'Kitchen & Home',
      sku: 'ECO-301',
    });
    expect(created.reorder_level).toBe(3);
    expect(created.stock_status).toBe('In Stock');

    const adjusted = await service.adjustStock(
      admin,
      created.product_id,
      -3,
      'Cycle count correction'
    );
    expect(adjusted.quantity).toBe(2);
    expect(adjusted.stock_status).toBe('Low Stock');

    const logs = await service.listInventoryAdjustments(admin.account_type, created.product_id);
    expect(logs.length).toBe(2);
    expect(logs[0].delta).toBe(-3);
    expect(logs[0].previous_qty).toBe(5);
    expect(logs[0].new_qty).toBe(2);
    expect(logs[0].reason).toBe('Cycle count correction');
    expect(logs[0].actor_name).toBe('Store Administrator');
    expect(logs[1].reason).toBe('Initial stock entry');

    await expect(service.listInventoryAdjustments(maria.account_type)).rejects.toThrowError(
      /Only administrators/
    );
  });

  it('archives products without breaking historical receipts and blocks new sales', async () => {
    const admin = await service.login('admin_qcu', 'admin123');
    const maria = await service.login('maria_santos', 'customer123');

    const item = await service.upsertProduct(admin, {
      product_name: 'Seasonal Bamboo Straws',
      description: 'Limited-edition portable straw set.',
      price: 90,
      quantity: 10,
      reorder_level: 2,
      category: 'Drinkware',
      sku: 'ECO-302',
    });

    const receipt = await service.processSale(maria, {
      checkoutToken: 'archive-history-check-1',
      lineItems: [{ product_id: item.product_id, quantity: 2 }],
    });

    const archived = await service.setProductArchived(admin, item.product_id, true);
    expect(archived.is_archived).toBe(1);

    // Excluded from active catalog, retained when includeArchived=true
    expect((await service.listCatalog()).some((p) => p.product_id === item.product_id)).toBe(false);
    expect(
      (await service.listCatalog('', 'ALL', 'ALL', true)).some(
        (p) => p.product_id === item.product_id
      )
    ).toBe(true);

    // Customers cannot includeArchived=1 via HTTP API
    const middleware = createApiMiddleware(db, 'test-secret');
    const loginRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'maria_santos', password: 'customer123' },
    });
    const setCookies = loginRes.headers['set-cookie'] as string[];
    const sessionCookie = setCookies.find((c) => c.startsWith('gc_session='))!.split(';')[0];
    const catalogRes = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/catalog?includeArchived=1',
      headers: { cookie: sessionCookie },
    });
    expect(catalogRes.statusCode).toBe(200);
    const itemsList = catalogRes.body.items as Array<{ product_id: number }>;
    expect(itemsList.some((p) => p.product_id === item.product_id)).toBe(false);

    // New checkout rejects archived SKU while historical receipt remains intact
    await expect(
      service.processSale(maria, {
        checkoutToken: 'archive-blocked-check-2',
        lineItems: [{ product_id: item.product_id, quantity: 1 }],
      })
    ).rejects.toThrowError(/archived and no longer available/i);

    const historicalReceipt = await service.getReceiptByToken(receipt.qr_code, maria);
    expect(historicalReceipt.items[0].product_name).toBe('Seasonal Bamboo Straws');
  });

  it('supports Phase 4 searchable admin transactions, CSV export escaping, and role guards', async () => {
    const admin = await service.login('admin_qcu', 'admin123');
    const maria = await service.login('maria_santos', 'customer123');
    const middleware = createApiMiddleware(db, 'test-secret');

    // Filter by customer and sort ascending/highest
    const mariaTxs = await service.searchTransactions(admin.account_type, {
      customerAccountId: maria.account_id,
      sort: 'highest',
    });
    expect(mariaTxs.length).toBeGreaterThanOrEqual(2);
    expect(mariaTxs[0].total_amount).toBeGreaterThanOrEqual(mariaTxs[1].total_amount);

    // Search by seeded transaction ID or QR prefix
    const byId = await service.searchTransactions(admin.account_type, { search: '1001' });
    expect(byId.length).toBe(1);
    expect(byId[0].transaction_id).toBe(1001);

    // Date filter validation rejects malformed dates
    await expect(
      service.searchTransactions(admin.account_type, { dateFrom: '2026/11/01' })
    ).rejects.toThrowError(/Invalid dateFrom/);

    // Customer cannot query all store transactions or CSV export via HTTP (403)
    const custLogin = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'maria_santos', password: 'customer123' },
    });
    const custCookie = (custLogin.headers['set-cookie'] as string[])
      .find((c) => c.startsWith('gc_session='))!
      .split(';')[0];

    const forbiddenTx = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/transactions',
      headers: { cookie: custCookie },
    });
    expect(forbiddenTx.statusCode).toBe(403);

    const forbiddenCsv = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/transactions/export.csv',
      headers: { cookie: custCookie },
    });
    expect(forbiddenCsv.statusCode).toBe(403);

    // Register a formula-prefixed customer name to verify CSV formula neutralization
    const riskyCustomer = await service.registerCustomer({
      username: 'formula_user',
      password: 'password123',
      full_name: '=CMD|calc',
    });
    await service.processSale(riskyCustomer, {
      checkoutToken: 'csv-escape-check-1',
      lineItems: [{ product_id: 1, quantity: 1 }],
    });

    const csv = await service.exportTransactionsCsv(admin.account_type, {
      customerAccountId: riskyCustomer.account_id,
    });
    expect(csv).toContain("'=CMD|calc");
    expect(csv.split('\r\n')[0]).toContain('transaction_id,transaction_date');
  });

  it('supports Phase 4 customer profile and password controls with strict ownership and CSRF checks', async () => {
    const middleware = createApiMiddleware(db, 'test-secret');

    const loginRes = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'maria_santos', password: 'customer123' },
    });
    const sessionCookie = (loginRes.headers['set-cookie'] as string[])
      .find((c) => c.startsWith('gc_session='))!
      .split(';')[0];
    const csrfToken = String(loginRes.body.csrfToken);

    // Reject missing CSRF on profile update
    const noCsrf = await invokeMiddleware(middleware, {
      method: 'PATCH',
      url: '/api/account/profile',
      headers: { cookie: sessionCookie },
      body: { full_name: 'Maria S. Updated' },
    });
    expect(noCsrf.statusCode).toBe(403);

    // Reject cross-account tampering even with valid CSRF
    const crossAccount = await invokeMiddleware(middleware, {
      method: 'PATCH',
      url: '/api/account/profile',
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      body: { account_id: 2, full_name: 'Tampered Name' },
    });
    expect(crossAccount.statusCode).toBe(403);

    // Valid self profile update updates DB & refreshes session cookie
    const updateOk = await invokeMiddleware(middleware, {
      method: 'PATCH',
      url: '/api/account/profile',
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      body: { full_name: 'Maria Santos-Reyes' },
    });
    expect(updateOk.statusCode).toBe(200);
    expect((updateOk.body.user as { full_name: string }).full_name).toBe('Maria Santos-Reyes');

    const nextCookie = (updateOk.headers['set-cookie'] as string[])
      .find((c) => c.startsWith('gc_session='))!
      .split(';')[0];
    const nextCsrf = String(updateOk.body.csrfToken);

    const meRes = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: nextCookie },
    });
    expect((meRes.body.user as { full_name: string }).full_name).toBe('Maria Santos-Reyes');

    // Wrong current password rejected
    const badCurrent = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/account/password',
      headers: { cookie: nextCookie, 'x-csrf-token': nextCsrf },
      body: { currentPassword: 'wrongpassword', newPassword: 'newpassword99' },
    });
    expect(badCurrent.statusCode).toBe(400);

    // Valid password rotation works and old password fails
    const passOk = await invokeMiddleware(middleware, {
      method: 'POST',
      url: '/api/account/password',
      headers: { cookie: nextCookie, 'x-csrf-token': nextCsrf },
      body: { currentPassword: 'customer123', newPassword: 'newpassword99' },
    });
    expect(passOk.statusCode).toBe(200);

    await expect(service.login('maria_santos', 'customer123')).rejects.toThrowError(
      /Invalid username/
    );
    expect((await service.login('maria_santos', 'newpassword99')).full_name).toBe(
      'Maria Santos-Reyes'
    );
  });

  it('verifies Phase 5 Eco-Impact specification, boundary calculations, seed reconciliation, and pending-metric exclusion', async () => {
    const admin = await service.login('admin_qcu', 'admin123');

    // Boundary and rounding tests against ECO_IMPACT_SPEC constants
    expect(calculateEcoMetrics(0)).toEqual({ paper_saved: 0, carbon_reduction: 0 });
    expect(calculateEcoMetrics(-2)).toEqual({ paper_saved: 0, carbon_reduction: 0 });
    expect(calculateEcoMetrics(1.5)).toEqual({ paper_saved: 0, carbon_reduction: 0 });
    expect(calculateEcoMetrics(1)).toEqual({ paper_saved: 1.25, carbon_reduction: 4.38 });
    expect(calculateEcoMetrics(2)).toEqual({ paper_saved: 1.5, carbon_reduction: 5.25 });
    expect(calculateEcoMetrics(3)).toEqual({ paper_saved: 1.75, carbon_reduction: 6.13 });

    // Seeded eco_impact rows reconcile 100% with calculateEcoMetrics(distinctLineCount)
    const seededRows = db
      .prepare(
        `SELECT ei.transaction_id,
                CAST(ei.paper_saved AS REAL) AS paper_saved,
                CAST(ei.carbon_reduction AS REAL) AS carbon_reduction,
                COUNT(td.detail_id) AS distinct_lines
         FROM eco_impact ei
         INNER JOIN transaction_details td ON td.transaction_id = ei.transaction_id
         GROUP BY ei.transaction_id
         ORDER BY ei.transaction_id ASC`
      )
      .all() as Array<{
      transaction_id: number;
      paper_saved: number;
      carbon_reduction: number;
      distinct_lines: number;
    }>;

    expect(seededRows.length).toBeGreaterThanOrEqual(3);
    for (const row of seededRows) {
      const expected = calculateEcoMetrics(row.distinct_lines);
      expect(row.paper_saved).toBe(expected.paper_saved);
      expect(row.carbon_reduction).toBe(expected.carbon_reduction);
    }

    // Schema guard: eco_impact does not invent unapproved water columns
    const ecoColumns = (
      db.prepare('PRAGMA table_info(eco_impact)').all() as Array<{ name: string }>
    ).map((c) => c.name);
    expect(ecoColumns).toEqual(['impact_id', 'transaction_id', 'paper_saved', 'carbon_reduction']);

    // Summary exposes traceable specification metadata & estimate flags
    const summary = await service.getEcoImpactSummary(admin, 'store');
    expect(summary.specification).toEqual(ECO_IMPACT_SPEC);
    expect(summary.specification?.metrics.map((m) => m.key)).toEqual([
      'paper_saved',
      'carbon_reduction',
      'paperless_count',
    ]);
    expect(summary.specification?.pending_approval_note).toMatch(/Water saved is excluded/i);
  });

  it('serves redacted public digital receipts by QR token without authentication', async () => {
    const middleware = createApiMiddleware(db, 'test-secret');
    const publicRes = await invokeMiddleware(middleware, {
      method: 'GET',
      url: '/api/public/receipts/token/GC-7D30B59E42A1',
    });
    expect(publicRes.statusCode).toBe(200);
    const body = publicRes.body as {
      receipt: { qr_code: string; customer_name: string; customer_username: string; items: unknown[] };
    };
    expect(body.receipt.qr_code).toBe('GC-7D30B59E42A1');
    expect(body.receipt.customer_name).toBe('GreenCart Customer');
    expect(body.receipt.customer_username).toBe('verified_receipt');
    expect(body.receipt.items.length).toBeGreaterThan(0);
  });
});

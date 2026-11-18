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

  it('registers a customer with a salted scrypt hash and blocks admin self-registration', () => {
    const created = service.registerCustomer({
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

    expect(() =>
      service.registerCustomer({
        username: 'fake_admin',
        password: 'Password123',
        full_name: 'Fake Admin',
        account_type: 'admin',
      })
    ).toThrowError(AppError);
  });

  it('rejects bad passwords and enforces role guards on admin operations', () => {
    expect(() => service.login('maria_santos', 'wrong-pass')).toThrowError(/Invalid username or password/);

    const maria = service.login('maria_santos', 'customer123');
    expect(maria.account_type).toBe('customer');

    expect(() =>
      service.upsertProduct(maria.account_type, {
        product_name: 'Unauthorized Item',
        description: 'Should fail',
        price: 99,
        quantity: 10,
      })
    ).toThrowError(/Only administrators/);

    expect(() => service.adjustStock(maria.account_type, 1, 5)).toThrowError(/Only administrators/);
    expect(() => service.getDatabaseSnapshot(maria)).toThrowError(/Administrator access required/);
  });

  it('searches catalog, synchronizes stock_status, and rejects negative stock', () => {
    const bamboo = service.listCatalog('bamboo');
    expect(bamboo.length).toBe(2);

    const admin = service.login('admin_qcu', 'admin123');
    // Product 1 starts at 34 ('In Stock'); adjust by -26 -> 8 ('Low Stock')
    const low = service.adjustStock(admin.account_type, 1, -26);
    expect(low.quantity).toBe(8);
    expect(low.stock_status).toBe('Low Stock');

    // Adjust to 0 -> 'Out of Stock'
    const zero = service.adjustStock(admin.account_type, 1, -8);
    expect(zero.quantity).toBe(0);
    expect(zero.stock_status).toBe('Out of Stock');

    // Negative stock rejected
    expect(() => service.adjustStock(admin.account_type, 1, -1)).toThrowError(/cannot become negative/);
  });

  it('ignores client-tampered prices/totals and deducts stock atomically across Customer & POS sales', () => {
    const maria = service.login('maria_santos', 'customer123');
    const admin = service.login('admin_qcu', 'admin123');

    // Product 1 is 145.00 (qty 34), Product 2 is 220.00 (qty 18)
    // Tamper client payload with bogus prices and total_amount = 1.00
    const customerReceipt = service.processSale(maria, {
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
    const posReceipt = service.processSale(admin, {
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

  it('rolls back entire transaction on insufficient stock, mid-sale failure, and blocks duplicate submissions', () => {
    const maria = service.login('maria_santos', 'customer123');
    const beforeTxCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get() as { cnt: number }
    ).cnt;

    // Product 7 has 0 stock
    expect(() =>
      service.processSale(maria, {
        checkoutToken: 'tok-fail-stock',
        lineItems: [
          { product_id: 1, quantity: 1 },
          { product_id: 7, quantity: 1 },
        ],
      })
    ).toThrowError(/Insufficient stock/);

    // Mid-transaction failure hook after inserts
    expect(() =>
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
    ).toThrowError('Simulated crash before commit');

    const afterTxCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM transactions').get() as { cnt: number }
    ).cnt;
    const prod1Stock = (
      db.prepare('SELECT quantity FROM inventory WHERE product_id = 1').get() as { quantity: number }
    ).quantity;

    expect(afterTxCount).toBe(beforeTxCount);
    expect(prod1Stock).toBe(34); // completely untouched

    // Duplicate checkoutToken protection
    service.processSale(maria, {
      checkoutToken: 'tok-once',
      lineItems: [{ product_id: 1, quantity: 1 }],
    });
    expect(() =>
      service.processSale(maria, {
        checkoutToken: 'tok-once',
        lineItems: [{ product_id: 1, quantity: 1 }],
      })
    ).toThrowError(/Duplicate sale submission blocked/);
  });

  it('enforces receipt lookup, local QR generation, cross-customer ownership, and Eco-Impact reconciliation', async () => {
    const maria = service.login('maria_santos', 'customer123');
    const juan = service.login('juan_delacruz', 'customer123');

    // Valid token lookup & local QR image generation
    const mariaReceipt = service.getReceiptByToken('GC-7D30B59E42A1', maria);
    expect(mariaReceipt.transaction_id).toBe(1002);
    const qrDataUrl = await QRCode.toDataURL(`https://greencart.local/?receipt=${mariaReceipt.qr_code}`);
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // Invalid token discloses nothing
    expect(() => service.getReceiptByToken('GC-DEADBEEF0000', maria)).toThrowError(/No digital receipt/);

    // Customer A (Maria) cannot access Customer B (Juan)'s history or private receipt
    expect(() => service.getCustomerHistory(maria, juan.account_id)).toThrowError(/Access denied/);
    expect(() => service.getReceiptByTransactionId(1003, maria)).toThrowError(/Access denied/);
    expect(() => service.getReceiptByToken('GC-9F28E14C66B9', maria)).toThrowError(/Access denied/);

    // Eco-Impact reconciliation against DB aggregates
    const personalSummary = service.getEcoImpactSummary(maria, 'personal');
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

  it('rejects expired signed session tokens', () => {
    const maria = service.login('maria_santos', 'customer123');
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

  it('supports Phase 1 category filtering, product image metadata, and safe admin image uploads', () => {
    const maria = service.login('maria_santos', 'customer123');
    const admin = service.login('admin_qcu', 'admin123');

    const drinkware = service.listCatalog('', 'ALL', 'Drinkware');
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
      const created = service.upsertProduct(admin.account_type, {
        product_name: 'Stainless Straw Kit',
        description: 'Reusable metal straws with cleaning brush.',
        price: 120,
        quantity: 14,
        category: 'Drinkware',
        image_url: uploaded.image_url,
      });
      expect(created.category).toBe('Drinkware');
      expect(created.image_url).toBe(uploaded.image_url);
      expect(service.listCatalog('', 'ALL', 'Drinkware').length).toBe(2);
    } finally {
      const diskPath = path.join(process.cwd(), 'public', uploaded.image_url);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
  });
});

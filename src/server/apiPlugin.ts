import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { Connect, Plugin } from 'vite';
import { signSessionToken, verifySessionToken } from './crypto.ts';
import { openDatabase, resetDatabase } from './db.ts';
import { AppError, GreenCartService } from './service.ts';
import type {
  AdminTransactionFilter,
  AdminTransactionSort,
  EcoScope,
  SafeUser,
  SaleRequestPayload,
} from '../shared/types.ts';

const SESSION_COOKIE = 'gc_session';
const CSRF_COOKIE = 'gc_csrf';
const IS_PROD = process.env.NODE_ENV === 'production';

function resolveSessionSecret(): string {
  const configured = process.env.GREENCART_SESSION_SECRET;
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (IS_PROD) {
    throw new Error(
      'GREENCART_SESSION_SECRET (min 16 chars) must be set when NODE_ENV=production.'
    );
  }
  return 'greencart-local-dev-secret-change-in-production-2026';
}

const COOKIE_SECURITY = IS_PROD ? '; Secure' : '';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = decodeURIComponent(part.slice(eqIdx + 1).trim());
    result[key] = val;
  }
  return result;
}

function createCsrfToken(sessionToken: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`csrf:${sessionToken}`)
    .digest('base64url');
}

function verifyCsrfToken(sessionToken: string, candidate: string | undefined, secret: string): boolean {
  if (!candidate) return false;
  const expected = createCsrfToken(sessionToken, secret);
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(400, 'Malformed JSON request body.');
  }
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  cookies?: string[]
): void {
  if (cookies && cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function parseTransactionFilters(url: URL): AdminTransactionFilter {
  const rawCust = url.searchParams.get('customerAccountId');
  const rawLimit = url.searchParams.get('limit');
  return {
    search: url.searchParams.get('search') || undefined,
    customerAccountId: rawCust ? Number(rawCust) : undefined,
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    sort: (url.searchParams.get('sort') as AdminTransactionSort | null) || undefined,
    limit: rawLimit ? Number(rawLimit) : undefined,
  };
}

export function createApiMiddleware(
  db: DatabaseSync,
  secret: string = resolveSessionSecret()
): Connect.NextHandleFunction {
  const service = new GreenCartService(db);

  return async (req, res, next) => {
    const urlStr = req.url || '/';
    if (!urlStr.startsWith('/api/')) {
      next();
      return;
    }

    const url = new URL(urlStr, 'http://localhost');
    const pathname = url.pathname;
    const method = (req.method || 'GET').toUpperCase();
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE] || '';
    const sessionUser: SafeUser | null = sessionToken
      ? verifySessionToken(sessionToken, secret)
      : null;

    const requireAuth = (): SafeUser => {
      if (!sessionUser) {
        throw new AppError(401, 'Authentication required.');
      }
      return sessionUser;
    };

    const requireCsrf = (): void => {
      if (!sessionToken || !sessionUser) {
        throw new AppError(401, 'Authentication required.');
      }
      const headerToken = req.headers['x-csrf-token'];
      const candidate = Array.isArray(headerToken) ? headerToken[0] : headerToken;
      if (!verifyCsrfToken(sessionToken, candidate, secret)) {
        throw new AppError(403, 'Invalid or missing CSRF token.');
      }
    };

    try {
      // GET /api/auth/me (refreshes rolling 30-minute session when authenticated)
      if (method === 'GET' && pathname === '/api/auth/me') {
        const currentAccount = sessionUser
          ? await service.getAccountById(sessionUser.account_id)
          : null;
        if (currentAccount) {
          const refreshedToken = signSessionToken(currentAccount, secret);
          const refreshedCsrf = createCsrfToken(refreshedToken, secret);
          sendJson(res, 200, { user: currentAccount, csrfToken: refreshedCsrf }, [
            `${SESSION_COOKIE}=${encodeURIComponent(refreshedToken)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
            `${CSRF_COOKIE}=${encodeURIComponent(refreshedCsrf)}; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
          ]);
          return;
        }
        sendJson(res, 200, { user: null, csrfToken: null });
        return;
      }

      // PATCH /api/account/profile (self-service display name update)
      if (method === 'PATCH' && pathname === '/api/account/profile') {
        const actor = requireAuth();
        requireCsrf();
        const body = await readJsonBody<{ full_name?: string; account_id?: number }>(req);
        const updatedUser = await service.updateAccountProfile(actor, {
          full_name: body.full_name || '',
          account_id: body.account_id,
        });
        const refreshedToken = signSessionToken(updatedUser, secret);
        const refreshedCsrf = createCsrfToken(refreshedToken, secret);
        sendJson(res, 200, { user: updatedUser, csrfToken: refreshedCsrf }, [
          `${SESSION_COOKIE}=${encodeURIComponent(refreshedToken)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
          `${CSRF_COOKIE}=${encodeURIComponent(refreshedCsrf)}; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
        ]);
        return;
      }

      // POST /api/account/password (self-service password rotation)
      if (method === 'POST' && pathname === '/api/account/password') {
        const actor = requireAuth();
        requireCsrf();
        const body = await readJsonBody<{
          currentPassword?: string;
          newPassword?: string;
          account_id?: number;
        }>(req);
        await service.changePassword(actor, {
          currentPassword: body.currentPassword || '',
          newPassword: body.newPassword || '',
          account_id: body.account_id,
        });
        sendJson(res, 200, { ok: true });
        return;
      }

      // POST /api/auth/login
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody<{ username?: string; password?: string }>(req);
        const user = await service.login(body.username || '', body.password || '');
        const token = signSessionToken(user, secret);
        const csrfToken = createCsrfToken(token, secret);
        sendJson(res, 200, { user, csrfToken }, [
          `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
          `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
        ]);
        return;
      }

      // POST /api/auth/register
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody<{
          username?: string;
          password?: string;
          full_name?: string;
          account_type?: string;
        }>(req);
        const user = await service.registerCustomer({
          username: body.username || '',
          password: body.password || '',
          full_name: body.full_name || '',
          account_type: body.account_type,
        });
        const token = signSessionToken(user, secret);
        const csrfToken = createCsrfToken(token, secret);
        sendJson(res, 201, { user, csrfToken }, [
          `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
          `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=Lax${COOKIE_SECURITY}`,
        ]);
        return;
      }

      // POST /api/auth/logout
      if (method === 'POST' && pathname === '/api/auth/logout') {
        if (sessionUser) {
          requireCsrf();
        }
        sendJson(res, 200, { ok: true }, [
          `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
          `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
        ]);
        return;
      }

      // GET /api/catalog
      if (method === 'GET' && pathname === '/api/catalog') {
        const actor = requireAuth();
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || 'ALL';
        const category = url.searchParams.get('category') || 'ALL';
        const includeArchived =
          actor.account_type === 'admin' && url.searchParams.get('includeArchived') === '1';
        const items = await service.listCatalog(search, status, category, includeArchived);
        sendJson(res, 200, { items });
        return;
      }

      // GET /api/customers (admin only for POS selector)
      if (method === 'GET' && pathname === '/api/customers') {
        const actor = requireAuth();
        const customers = await service.listCustomerAccounts(actor.account_type);
        sendJson(res, 200, { customers });
        return;
      }

      // POST /api/uploads/product-image (admin only)
      if (method === 'POST' && pathname === '/api/uploads/product-image') {
        const actor = requireAuth();
        requireCsrf();
        const body = await readJsonBody<{
          filename?: string;
          mimeType?: string;
          base64Data?: string;
        }>(req);
        const uploaded = service.saveProductImageUpload(actor.account_type, {
          filename: body.filename || 'upload.png',
          mimeType: body.mimeType || '',
          base64Data: body.base64Data || '',
        });
        sendJson(res, 201, uploaded);
        return;
      }

      // POST /api/products (admin only)
      if (method === 'POST' && pathname === '/api/products') {
        const actor = requireAuth();
        requireCsrf();
        const body = await readJsonBody<{
          product_name?: string;
          description?: string;
          price?: number;
          quantity?: number;
          reorder_level?: number;
          is_archived?: boolean | number;
          category?: string;
          image_url?: string | null;
          sku?: string | null;
        }>(req);
        const item = await service.upsertProduct(actor, {
          product_name: body.product_name || '',
          description: body.description || '',
          price: Number(body.price),
          quantity: Number(body.quantity),
          reorder_level: body.reorder_level,
          is_archived: body.is_archived,
          category: body.category,
          image_url: body.image_url,
          sku: body.sku,
        });
        sendJson(res, 201, { item });
        return;
      }

      // PUT /api/products/:id (admin only)
      const updateProdMatch = pathname.match(/^\/api\/products\/(\d+)$/);
      if (method === 'PUT' && updateProdMatch) {
        const actor = requireAuth();
        requireCsrf();
        const productId = Number(updateProdMatch[1]);
        const body = await readJsonBody<{
          product_name?: string;
          description?: string;
          price?: number;
          quantity?: number;
          reorder_level?: number;
          is_archived?: boolean | number;
          category?: string;
          image_url?: string | null;
          sku?: string | null;
          adjustment_reason?: string;
        }>(req);
        const item = await service.upsertProduct(actor, {
          product_id: productId,
          product_name: body.product_name || '',
          description: body.description || '',
          price: Number(body.price),
          quantity: Number(body.quantity),
          reorder_level: body.reorder_level,
          is_archived: body.is_archived,
          category: body.category,
          image_url: body.image_url,
          sku: body.sku,
          adjustment_reason: body.adjustment_reason,
        });
        sendJson(res, 200, { item });
        return;
      }

      // PATCH /api/products/:id/archive (admin only)
      const archiveProdMatch = pathname.match(/^\/api\/products\/(\d+)\/archive$/);
      if (method === 'PATCH' && archiveProdMatch) {
        const actor = requireAuth();
        requireCsrf();
        const productId = Number(archiveProdMatch[1]);
        const body = await readJsonBody<{ is_archived?: boolean }>(req);
        const item = await service.setProductArchived(actor, productId, Boolean(body.is_archived));
        sendJson(res, 200, { item });
        return;
      }

      // GET /api/inventory/adjustments (admin only)
      if (method === 'GET' && pathname === '/api/inventory/adjustments') {
        const actor = requireAuth();
        const productIdParam = url.searchParams.get('productId');
        const productId = productIdParam ? Number(productIdParam) : undefined;
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number(limitParam) : 100;
        const adjustments = await service.listInventoryAdjustments(
          actor.account_type,
          productId,
          limit
        );
        sendJson(res, 200, { adjustments });
        return;
      }

      // PATCH /api/inventory/:productId/adjust (admin only)
      const adjustStockMatch = pathname.match(/^\/api\/inventory\/(\d+)\/adjust$/);
      if (method === 'PATCH' && adjustStockMatch) {
        const actor = requireAuth();
        requireCsrf();
        const productId = Number(adjustStockMatch[1]);
        const body = await readJsonBody<{ delta?: number; reason?: string }>(req);
        const item = await service.adjustStock(
          actor,
          productId,
          Number(body.delta),
          body.reason || 'Quick stock adjustment'
        );
        sendJson(res, 200, { item });
        return;
      }

      // POST /api/sales (shared Customer Checkout & Admin POS)
      if (method === 'POST' && pathname === '/api/sales') {
        const actor = requireAuth();
        requireCsrf();
        const body = await readJsonBody<SaleRequestPayload>(req);
        const receipt = await service.processSale(actor, body);
        sendJson(res, 201, { receipt });
        return;
      }

      // GET /api/public/receipts/token/:qrCode (unauthenticated QR scan, redacted PII)
      const publicReceiptTokenMatch = pathname.match(/^\/api\/public\/receipts\/token\/([^/]+)$/);
      if (method === 'GET' && publicReceiptTokenMatch) {
        const token = decodeURIComponent(publicReceiptTokenMatch[1]);
        const receipt = await service.getPublicReceiptByToken(token);
        sendJson(res, 200, { receipt });
        return;
      }

      // GET /api/receipts/token/:qrCode
      const receiptTokenMatch = pathname.match(/^\/api\/receipts\/token\/([^/]+)$/);
      if (method === 'GET' && receiptTokenMatch) {
        const actor = requireAuth();
        const token = decodeURIComponent(receiptTokenMatch[1]);
        const receipt = await service.getReceiptByToken(token, actor);
        sendJson(res, 200, { receipt });
        return;
      }

      // GET /api/transactions/:id/receipt
      const receiptTxMatch = pathname.match(/^\/api\/transactions\/(\d+)\/receipt$/);
      if (method === 'GET' && receiptTxMatch) {
        const actor = requireAuth();
        const txId = Number(receiptTxMatch[1]);
        const receipt = await service.getReceiptByTransactionId(txId, actor);
        sendJson(res, 200, { receipt });
        return;
      }

      // GET /api/transactions (admin searchable/filterable/sortable transaction list)
      if (method === 'GET' && pathname === '/api/transactions') {
        const actor = requireAuth();
        const transactions = await service.searchTransactions(
          actor.account_type,
          parseTransactionFilters(url)
        );
        sendJson(res, 200, { transactions });
        return;
      }

      // GET /api/transactions/export.csv (admin CSV export)
      if (method === 'GET' && pathname === '/api/transactions/export.csv') {
        const actor = requireAuth();
        const csv = await service.exportTransactionsCsv(
          actor.account_type,
          parseTransactionFilters(url)
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="greencart-transactions.csv"');
        res.setHeader('Cache-Control', 'no-store');
        res.end(csv);
        return;
      }

      // GET /api/history
      if (method === 'GET' && pathname === '/api/history') {
        const actor = requireAuth();
        const requestedAccountIdParam = url.searchParams.get('accountId');
        const requestedAccountId = requestedAccountIdParam
          ? Number(requestedAccountIdParam)
          : undefined;
        const history = await service.getCustomerHistory(actor, requestedAccountId);
        sendJson(res, 200, { history });
        return;
      }

      // GET /api/eco-impact
      if (method === 'GET' && pathname === '/api/eco-impact') {
        const actor = requireAuth();
        const rawScope = url.searchParams.get('scope');
        const scope: EcoScope = rawScope === 'store' ? 'store' : 'personal';
        const summary = await service.getEcoImpactSummary(actor, scope);
        sendJson(res, 200, { summary });
        return;
      }

      // GET /api/db/snapshot (admin inspector)
      if (method === 'GET' && pathname === '/api/db/snapshot') {
        const actor = requireAuth();
        const snapshot = await service.getDatabaseSnapshot(actor);
        sendJson(res, 200, { snapshot });
        return;
      }

      // POST /api/db/reset (admin demo reset)
      if (method === 'POST' && pathname === '/api/db/reset') {
        const actor = requireAuth();
        requireCsrf();
        if (actor.account_type !== 'admin') {
          throw new AppError(403, 'Only administrators can reset the database.');
        }
        resetDatabase(db);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: `Unknown API route: ${method} ${pathname}` });
    } catch (err) {
      if (err instanceof AppError) {
        sendJson(res, err.statusCode, { error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unexpected server error.';
      sendJson(res, 500, { error: message });
    }
  };
}

export function greenCartApiPlugin(): Plugin {
  let db: DatabaseSync | null = null;
  const ensureMiddleware = () => {
    if (!db) {
      db = openDatabase();
    }
    return createApiMiddleware(db);
  };

  return {
    name: 'greencart-api-plugin',
    configureServer(server) {
      server.middlewares.use(ensureMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(ensureMiddleware());
    },
  };
}

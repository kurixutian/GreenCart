import { demoApi } from './demoStore';
import type {
  AdminTransactionFilter,
  AdminTransactionItem,
  CatalogItem,
  DatabaseSnapshot,
  DigitalReceiptView,
  EcoImpactSummary,
  EcoScope,
  InventoryAdjustmentView,
  PurchaseHistoryItem,
  SafeUser,
  SaleLineInput,
} from '../shared/types';

let csrfTokenCache: string | null = null;
let staticDemoMode = import.meta.env.VITE_STATIC_DEMO === 'true';

function setCsrfToken(token: string | null): void {
  csrfTokenCache = token;
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && csrfTokenCache) {
    headers.set('X-CSRF-Token', csrfTokenCache);
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && (res.status === 404 || res.status === 405)) {
    throw new Error('API backend is unavailable on this static host.');
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function buildTransactionParams(filters: AdminTransactionFilter = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.customerAccountId) params.set('customerAccountId', String(filters.customerAccountId));
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  return params;
}

export const api = {
  isStaticDemoMode(): boolean {
    return staticDemoMode;
  },

  async me(): Promise<{ user: SafeUser | null; csrfToken: string | null }> {
    if (staticDemoMode) {
      return demoApi.me();
    }
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') || res.status === 404 || res.status === 405) {
        staticDemoMode = true;
        return demoApi.me();
      }
      const data = (await res.json()) as {
        user: SafeUser | null;
        csrfToken: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setCsrfToken(data.csrfToken);
      return { user: data.user, csrfToken: data.csrfToken };
    } catch (err) {
      if (err instanceof TypeError) {
        staticDemoMode = true;
        return demoApi.me();
      }
      throw err;
    }
  },

  async login(
    username: string,
    password: string
  ): Promise<{ user: SafeUser; csrfToken: string }> {
    if (staticDemoMode) return demoApi.login(username, password);
    const res = await requestJson<{ user: SafeUser; csrfToken: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
    setCsrfToken(res.csrfToken);
    return res;
  },

  async register(
    username: string,
    password: string,
    full_name: string
  ): Promise<{ user: SafeUser; csrfToken: string }> {
    if (staticDemoMode) return demoApi.register({ username, password, full_name });
    const res = await requestJson<{ user: SafeUser; csrfToken: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, full_name }),
      }
    );
    setCsrfToken(res.csrfToken);
    return res;
  },

  async logout(): Promise<void> {
    if (staticDemoMode) {
      await demoApi.logout();
      setCsrfToken(null);
      return;
    }
    await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    setCsrfToken(null);
  },

  async updateProfile(full_name: string): Promise<{ user: SafeUser; csrfToken: string }> {
    if (staticDemoMode) return demoApi.updateProfile(full_name);
    const res = await requestJson<{ user: SafeUser; csrfToken: string }>(
      '/api/account/profile',
      {
        method: 'PATCH',
        body: JSON.stringify({ full_name }),
      }
    );
    setCsrfToken(res.csrfToken);
    return res;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (staticDemoMode) return demoApi.changePassword(currentPassword, newPassword);
    await requestJson<{ ok: boolean }>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async getCatalog(
    search = '',
    status = 'ALL',
    category = 'ALL',
    includeArchived = false
  ): Promise<CatalogItem[]> {
    if (staticDemoMode) return demoApi.getCatalog(search, status, category, includeArchived);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status && status !== 'ALL') params.set('status', status);
    if (category && category !== 'ALL') params.set('category', category);
    if (includeArchived) params.set('includeArchived', '1');
    const qs = params.toString();
    const res = await requestJson<{ items: CatalogItem[] }>(
      `/api/catalog${qs ? `?${qs}` : ''}`
    );
    return res.items;
  },

  async getCustomers(): Promise<SafeUser[]> {
    if (staticDemoMode) return demoApi.getCustomers();
    const res = await requestJson<{ customers: SafeUser[] }>('/api/customers');
    return res.customers;
  },

  async uploadProductImage(file: File): Promise<{ image_url: string }> {
    if (staticDemoMode) return demoApi.uploadProductImage(file);
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
    return requestJson<{ image_url: string }>('/api/uploads/product-image', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        base64Data,
      }),
    });
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
    if (staticDemoMode) return demoApi.createProduct(payload);
    const res = await requestJson<{ item: CatalogItem }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.item;
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
    if (staticDemoMode) return demoApi.updateProduct(productId, payload);
    const res = await requestJson<{ item: CatalogItem }>(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.item;
  },

  async setProductArchived(productId: number, isArchived: boolean): Promise<CatalogItem> {
    if (staticDemoMode) return demoApi.setProductArchived(productId, isArchived);
    const res = await requestJson<{ item: CatalogItem }>(`/api/products/${productId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: isArchived }),
    });
    return res.item;
  },

  async adjustStock(
    productId: number,
    delta: number,
    reason = 'Quick stock adjustment'
  ): Promise<CatalogItem> {
    if (staticDemoMode) return demoApi.adjustStock(productId, delta, reason);
    const res = await requestJson<{ item: CatalogItem }>(
      `/api/inventory/${productId}/adjust`,
      {
        method: 'PATCH',
        body: JSON.stringify({ delta, reason }),
      }
    );
    return res.item;
  },

  async getInventoryAdjustments(
    productId?: number,
    limit = 100
  ): Promise<InventoryAdjustmentView[]> {
    if (staticDemoMode) return demoApi.getInventoryAdjustments(productId, limit);
    const params = new URLSearchParams();
    if (productId) params.set('productId', String(productId));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const res = await requestJson<{ adjustments: InventoryAdjustmentView[] }>(
      `/api/inventory/adjustments${qs ? `?${qs}` : ''}`
    );
    return res.adjustments;
  },

  async processSale(payload: {
    account_id?: number;
    lineItems: SaleLineInput[];
    checkoutToken: string;
  }): Promise<DigitalReceiptView> {
    if (staticDemoMode) return demoApi.processSale(payload);
    const res = await requestJson<{ receipt: DigitalReceiptView }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.receipt;
  },

  async getReceiptByToken(qrCode: string): Promise<DigitalReceiptView> {
    if (staticDemoMode) return demoApi.getReceiptByToken(qrCode);
    const res = await requestJson<{ receipt: DigitalReceiptView }>(
      `/api/receipts/token/${encodeURIComponent(qrCode)}`
    );
    return res.receipt;
  },

  async getReceiptByTransactionId(transactionId: number): Promise<DigitalReceiptView> {
    if (staticDemoMode) return demoApi.getReceiptByTransactionId(transactionId);
    const res = await requestJson<{ receipt: DigitalReceiptView }>(
      `/api/transactions/${transactionId}/receipt`
    );
    return res.receipt;
  },

  async getHistory(): Promise<PurchaseHistoryItem[]> {
    if (staticDemoMode) return demoApi.getHistory();
    const res = await requestJson<{ history: PurchaseHistoryItem[] }>('/api/history');
    return res.history;
  },

  async getAdminTransactions(
    filters: AdminTransactionFilter = {}
  ): Promise<AdminTransactionItem[]> {
    if (staticDemoMode) return demoApi.getAdminTransactions(filters);
    const params = buildTransactionParams(filters);
    const qs = params.toString();
    const res = await requestJson<{ transactions: AdminTransactionItem[] }>(
      `/api/transactions${qs ? `?${qs}` : ''}`
    );
    return res.transactions;
  },

  getTransactionsExportUrl(filters: AdminTransactionFilter = {}): string {
    const params = buildTransactionParams(filters);
    const qs = params.toString();
    return `/api/transactions/export.csv${qs ? `?${qs}` : ''}`;
  },

  downloadDemoTransactionsCsv(filters: AdminTransactionFilter = {}): void {
    demoApi.downloadTransactionsCsv(filters);
  },

  async getEcoImpact(scope: EcoScope): Promise<EcoImpactSummary> {
    if (staticDemoMode) return demoApi.getEcoImpact(scope);
    const res = await requestJson<{ summary: EcoImpactSummary }>(
      `/api/eco-impact?scope=${encodeURIComponent(scope)}`
    );
    return res.summary;
  },

  async getDbSnapshot(): Promise<DatabaseSnapshot> {
    if (staticDemoMode) return demoApi.getDbSnapshot();
    const res = await requestJson<{ snapshot: DatabaseSnapshot }>('/api/db/snapshot');
    return res.snapshot;
  },

  async resetDb(): Promise<void> {
    if (staticDemoMode) return demoApi.resetDb();
    await requestJson<{ ok: boolean }>('/api/db/reset', { method: 'POST' });
  },
};

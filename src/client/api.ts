import type {
  CatalogItem,
  DatabaseSnapshot,
  DigitalReceiptView,
  EcoImpactSummary,
  EcoScope,
  PurchaseHistoryItem,
  SafeUser,
  SaleLineInput,
} from '../shared/types';

let csrfTokenCache: string | null = null;

export function setCsrfToken(token: string | null): void {
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

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  async me(): Promise<{ user: SafeUser | null; csrfToken: string | null }> {
    const res = await requestJson<{ user: SafeUser | null; csrfToken: string | null }>(
      '/api/auth/me'
    );
    setCsrfToken(res.csrfToken);
    return res;
  },

  async login(
    username: string,
    password: string
  ): Promise<{ user: SafeUser; csrfToken: string }> {
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
    await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    setCsrfToken(null);
  },

  async getCatalog(search = '', status = 'ALL', category = 'ALL'): Promise<CatalogItem[]> {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status && status !== 'ALL') params.set('status', status);
    if (category && category !== 'ALL') params.set('category', category);
    const qs = params.toString();
    const res = await requestJson<{ items: CatalogItem[] }>(
      `/api/catalog${qs ? `?${qs}` : ''}`
    );
    return res.items;
  },

  async getCustomers(): Promise<SafeUser[]> {
    const res = await requestJson<{ customers: SafeUser[] }>('/api/customers');
    return res.customers;
  },

  async uploadProductImage(file: File): Promise<{ image_url: string }> {
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
    category?: string;
    image_url?: string | null;
    sku?: string | null;
  }): Promise<CatalogItem> {
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
      category?: string;
      image_url?: string | null;
      sku?: string | null;
    }
  ): Promise<CatalogItem> {
    const res = await requestJson<{ item: CatalogItem }>(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.item;
  },

  async adjustStock(productId: number, delta: number): Promise<CatalogItem> {
    const res = await requestJson<{ item: CatalogItem }>(
      `/api/inventory/${productId}/adjust`,
      {
        method: 'PATCH',
        body: JSON.stringify({ delta }),
      }
    );
    return res.item;
  },

  async processSale(payload: {
    account_id?: number;
    lineItems: SaleLineInput[];
    checkoutToken: string;
  }): Promise<DigitalReceiptView> {
    const res = await requestJson<{ receipt: DigitalReceiptView }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.receipt;
  },

  async getReceiptByToken(qrCode: string): Promise<DigitalReceiptView> {
    const res = await requestJson<{ receipt: DigitalReceiptView }>(
      `/api/receipts/token/${encodeURIComponent(qrCode)}`
    );
    return res.receipt;
  },

  async getReceiptByTransactionId(transactionId: number): Promise<DigitalReceiptView> {
    const res = await requestJson<{ receipt: DigitalReceiptView }>(
      `/api/transactions/${transactionId}/receipt`
    );
    return res.receipt;
  },

  async getHistory(): Promise<PurchaseHistoryItem[]> {
    const res = await requestJson<{ history: PurchaseHistoryItem[] }>('/api/history');
    return res.history;
  },

  async getEcoImpact(scope: EcoScope): Promise<EcoImpactSummary> {
    const res = await requestJson<{ summary: EcoImpactSummary }>(
      `/api/eco-impact?scope=${encodeURIComponent(scope)}`
    );
    return res.summary;
  },

  async getDbSnapshot(): Promise<DatabaseSnapshot> {
    const res = await requestJson<{ snapshot: DatabaseSnapshot }>('/api/db/snapshot');
    return res.snapshot;
  },

  async resetDb(): Promise<void> {
    await requestJson<{ ok: boolean }>('/api/db/reset', { method: 'POST' });
  },
};

import type { CatalogItem, StockStatus } from '../../shared/types';

export interface CartEntry {
  product_id: number;
  quantity: number;
}

export function resolveAssetUrl(raw?: string | null): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const clean = (raw || '').trim();
  if (!clean) return `${base}images/products/placeholder.svg`;
  if (clean.startsWith('/images/') || clean.startsWith('/uploads/')) {
    return `${base}${clean.slice(1)}`;
  }
  return clean;
}

export function formatCurrency(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getStockBadgeClasses(status: StockStatus): string {
  switch (status) {
    case 'In Stock':
      return 'bg-brand-50 text-brand-700 border border-brand-200';
    case 'Low Stock':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'Out of Stock':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
  }
}

export function mutateCart(
  cart: CartEntry[],
  product: CatalogItem | undefined,
  productId: number,
  delta: number,
  onNotify: (message: string, type?: 'success' | 'error') => void
): CartEntry[] {
  const maxStock = product?.quantity ?? 0;
  const current = cart.find((c) => c.product_id === productId);
  const nextQty = (current?.quantity ?? 0) + delta;

  if (delta > 0 && maxStock <= 0) {
    onNotify(`${product?.product_name ?? 'Item'} is out of stock.`, 'error');
    return cart;
  }
  if (nextQty > maxStock) {
    onNotify(`Only ${maxStock} unit(s) available in stock.`, 'error');
    return cart;
  }
  if (nextQty <= 0) {
    return cart.filter((c) => c.product_id !== productId);
  }
  return current
    ? cart.map((c) => (c.product_id === productId ? { ...c, quantity: nextQty } : c))
    : [...cart, { product_id: productId, quantity: nextQty }];
}

import { useState } from 'react';
import {
  Leaf,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from './Icons';
import {
  formatCurrency,
  getStockBadgeClasses,
  mutateCart,
  type CartEntry,
} from '../utils/format';
import { calculateEcoMetrics, type CatalogItem, type DigitalReceiptView } from '../../shared/types';
import { api } from '../api';

interface CatalogViewProps {
  catalog: CatalogItem[];
  cart: CartEntry[];
  onChangeCart: (next: CartEntry[]) => void;
  onSaleCompleted: (receipt: DigitalReceiptView) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
  mobileCartOpen: boolean;
  onCloseMobileCart: () => void;
}

export function CatalogView({
  catalog,
  cart,
  onChangeCart,
  onSaleCompleted,
  onNotify,
  mobileCartOpen,
  onCloseMobileCart,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [submitting, setSubmitting] = useState(false);

  const filtered = catalog.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.product_name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || item.stock_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function getCartQty(productId: number): number {
    return cart.find((c) => c.product_id === productId)?.quantity ?? 0;
  }

  function addToCart(item: CatalogItem) {
    onChangeCart(mutateCart(cart, item, item.product_id, 1, onNotify));
  }

  function updateCartQty(productId: number, delta: number) {
    const prod = catalog.find((p) => p.product_id === productId);
    onChangeCart(mutateCart(cart, prod, productId, delta, onNotify));
  }

  function removeFromCart(productId: number) {
    onChangeCart(cart.filter((c) => c.product_id !== productId));
  }

  async function handleCheckout() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const receipt = await api.processSale({
        lineItems: cart,
        checkoutToken: crypto.randomUUID(),
      });
      onChangeCart([]);
      onCloseMobileCart();
      onNotify(`Sale #${receipt.transaction_id} completed! Paperless receipt generated.`);
      onSaleCompleted(receipt);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Checkout failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const cartDetails = cart
    .map((entry) => {
      const prod = catalog.find((p) => p.product_id === entry.product_id);
      return prod ? { ...entry, product: prod } : null;
    })
    .filter((v): v is { product_id: number; quantity: number; product: CatalogItem } => v !== null);

  const estimatedTotal = cartDetails.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const ecoPreview = calculateEcoMetrics(cartDetails.length);

  const cartPanelBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-brand-600" />
          <h3 className="text-base font-bold text-slate-900">Your Eco Cart</h3>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
          {cartDetails.reduce((s, i) => s + i.quantity, 0)} items
        </span>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5 py-2">
        {cartDetails.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">Your cart is empty</p>
            <p className="mt-1 text-xs text-slate-400">
              Add sustainable essentials from the catalog to preview your paperless receipt savings.
            </p>
          </div>
        ) : (
          cartDetails.map(({ product, quantity }) => (
            <div key={product.product_id} className="flex items-start justify-between gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {product.product_name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                  {formatCurrency(product.price)} × {quantity} ={' '}
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(product.price * quantity)}
                  </span>
                </p>
                <div className="mt-2 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    aria-label={`Decrease ${product.product_name}`}
                    onClick={() => updateCartQty(product.product_id, -1)}
                    className="p-1.5 text-slate-600 hover:text-slate-900"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center font-mono text-xs font-semibold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.product_name}`}
                    onClick={() => updateCartQty(product.product_id, 1)}
                    className="p-1.5 text-slate-600 hover:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${product.product_name}`}
                onClick={() => removeFromCart(product.product_id)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 p-5">
        {cartDetails.length > 0 && (
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/80 p-3 text-xs text-brand-900">
            <div className="flex items-center gap-1.5 font-semibold text-brand-800">
              <Leaf className="h-3.5 w-3.5 text-brand-600" />
              Estimated Paperless Impact
            </div>
            <p className="mt-1 tabular-nums text-brand-700">
              Saves ~<strong>{ecoPreview.paper_saved.toFixed(2)} sheets</strong> &amp; reduces{' '}
              <strong>{ecoPreview.carbon_reduction.toFixed(2)} g CO₂e</strong> (estimate).
            </p>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600">Estimated Total</span>
          <span className="font-mono text-xl font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(estimatedTotal)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Final prices &amp; stock are verified server-side during atomic checkout.
        </p>

        <button
          type="button"
          disabled={cartDetails.length === 0 || submitting}
          onClick={handleCheckout}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackageCheck className="h-4 w-4" />
          {submitting ? 'Processing Checkout...' : 'Checkout & Generate QR Receipt'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Ogani-Inspired Storefront Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-700 p-6 text-white shadow-md sm:p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-brand-50">
            <Leaf className="h-3.5 w-3.5" />
            OGANI-INSPIRED ECO STOREFRONT
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Sustainable Everyday Goods, Zero Paper Waste
          </h2>
          <p className="mt-2 text-sm text-brand-100">
            Every purchase issues an instant cryptographic QR receipt and tracks estimated paper and carbon savings.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Catalog Column */}
        <div className="space-y-5 lg:col-span-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search eco-friendly products..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'In Stock', 'Low Stock', 'Out of Stock'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    statusFilter === status
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL' ? 'All Items' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              Showing <strong>{filtered.length}</strong> of {catalog.length} products
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No matching products found</p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing your search query or switching the stock status filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((item) => {
                const inCartQty = getCartQty(item.product_id);
                const outOfStock = item.quantity <= 0;
                const maxedOut = inCartQty >= item.quantity && !outOfStock;

                return (
                  <article
                    key={item.product_id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                          <Leaf className="h-5 w-5" />
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStockBadgeClasses(
                            item.stock_status
                          )}`}
                        >
                          {item.stock_status} ({item.quantity})
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900">
                        {item.product_name}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider text-slate-400">
                          Price
                        </span>
                        <span className="font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                          {formatCurrency(item.price)}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock || maxedOut}
                        onClick={() => addToCart(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {outOfStock
                          ? 'Unavailable'
                          : maxedOut
                            ? `Max in Cart (${inCartQty})`
                            : inCartQty > 0
                              ? `Add (${inCartQty} in cart)`
                              : 'Add to Cart'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Sticky Cart Panel */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {cartPanelBody}
          </div>
        </aside>
      </div>

      {/* Mobile Slide-Over Cart Drawer */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs lg:hidden">
          <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close Cart"
              onClick={onCloseMobileCart}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            {cartPanelBody}
          </div>
        </div>
      )}
    </div>
  );
}

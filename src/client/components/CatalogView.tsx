import { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Eye,
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
import {
  calculateEcoMetrics,
  PRODUCT_CATEGORIES,
  type CatalogItem,
  type DigitalReceiptView,
} from '../../shared/types';
import { api } from '../api';

const FALLBACK_PRODUCT_IMAGE = '/images/products/placeholder.svg';

function getInitialCategory(): string {
  return new URLSearchParams(window.location.search).get('category') || 'ALL';
}

type SortOption =
  | 'featured'
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'
  | 'stock-desc';

const VALID_SORTS = new Set<SortOption>([
  'featured',
  'name-asc',
  'name-desc',
  'price-asc',
  'price-desc',
  'stock-desc',
]);

function getInitialSort(): SortOption {
  const param = new URLSearchParams(window.location.search).get('sort') as SortOption | null;
  return param && VALID_SORTS.has(param) ? param : 'featured';
}

interface CatalogViewProps {
  catalog: CatalogItem[];
  cart: CartEntry[];
  onChangeCart: (next: CartEntry[]) => void;
  onSaleCompleted: (receipt: DigitalReceiptView) => void;
  onOpenCart: () => void;
  onNotify: (
    message: string,
    type?: 'success' | 'error',
    action?: { label: string; onClick: () => void }
  ) => void;
  mobileCartOpen: boolean;
  onCloseMobileCart: () => void;
}

export function CatalogView({
  catalog,
  cart,
  onChangeCart,
  onSaleCompleted,
  onOpenCart,
  onNotify,
  mobileCartOpen,
  onCloseMobileCart,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>(getInitialCategory);
  const [sortBy, setSortBy] = useState<SortOption>(getInitialSort);
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(null);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync sort and category params in URL (P1.3 & Phase 1)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (sortBy === 'featured') {
      url.searchParams.delete('sort');
    } else {
      url.searchParams.set('sort', sortBy);
    }
    if (categoryFilter === 'ALL') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', categoryFilter);
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [sortBy, categoryFilter]);

  // Escape closes product detail modal (P1.3)
  useEffect(() => {
    if (!selectedProduct) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProduct(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProduct]);

  const filtered = catalog
    .filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.product_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || item.stock_status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.product_name.localeCompare(b.product_name);
        case 'name-desc':
          return b.product_name.localeCompare(a.product_name);
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'stock-desc':
          return b.quantity - a.quantity;
        default:
          return a.product_id - b.product_id;
      }
    });

  function getCartQty(productId: number): number {
    return cart.find((c) => c.product_id === productId)?.quantity ?? 0;
  }

  function addToCart(item: CatalogItem) {
    setConfirmingCheckout(false);
    const next = mutateCart(cart, item, item.product_id, 1, onNotify);
    if (next !== cart) {
      onChangeCart(next);
      onNotify(`Added "${item.product_name}" to cart.`, 'success', {
        label: 'View Cart',
        onClick: onOpenCart,
      });
    }
  }

  function updateCartQty(productId: number, delta: number) {
    setConfirmingCheckout(false);
    const prod = catalog.find((p) => p.product_id === productId);
    onChangeCart(mutateCart(cart, prod, productId, delta, onNotify));
  }

  function removeFromCart(productId: number) {
    setConfirmingCheckout(false);
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
      setConfirmingCheckout(false);
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
            <p className="mt-1 text-xs text-slate-500">
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-600 hover:text-slate-900"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center font-mono text-xs font-semibold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.product_name}`}
                    disabled={quantity >= product.quantity}
                    onClick={() => updateCartQty(product.product_id, 1)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${product.product_name}`}
                onClick={() => removeFromCart(product.product_id)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/90 p-5">
        {cartDetails.length > 0 && (
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/80 p-3 text-xs text-brand-900">
            <div className="flex items-center gap-1.5 font-semibold text-brand-800">
              <Leaf className="h-3.5 w-3.5 text-brand-600" />
              Estimated Paperless Impact (Non-monetary)
            </div>
            <p className="mt-1 tabular-nums text-brand-700">
              Saves ~<strong>{ecoPreview.paper_saved.toFixed(2)} sheets</strong> &amp; reduces{' '}
              <strong>{ecoPreview.carbon_reduction.toFixed(2)} g CO₂e</strong> (estimate).
            </p>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600">Amount Due (Est.)</span>
          <span className="font-mono text-xl font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(estimatedTotal)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Final prices &amp; stock are verified server-side during atomic checkout.
        </p>

        {!confirmingCheckout ? (
          <button
            type="button"
            disabled={cartDetails.length === 0 || submitting}
            onClick={() => setConfirmingCheckout(true)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackageCheck className="h-4 w-4" />
            Review &amp; Confirm Order
          </button>
        ) : (
          <div className="mt-4 space-y-2 rounded-xl border border-brand-300 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800">
              Confirm paperless checkout for {formatCurrency(estimatedTotal)}?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingCheckout(false)}
                className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleCheckout()}
                className="min-h-11 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-700 p-5 text-white shadow-sm sm:p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-brand-50">
            <Leaf className="h-3.5 w-3.5" />
            BOTANICAL ECO MARKET
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Sustainable Everyday Goods, Zero Paper Waste
          </h1>
          <p className="mt-2 text-sm text-brand-100">
            Browse verified stock, inspect product details, and receive an instant cryptographic QR receipt at checkout.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search eco-friendly products..."
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-500" />
                <select
                  aria-label="Sort products"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white sm:w-auto"
                >
                  <option value="featured">Featured Order</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="stock-desc">Highest Stock</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['ALL', ...PRODUCT_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`min-h-11 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'In Stock', 'Low Stock', 'Out of Stock'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`min-h-11 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    statusFilter === status
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL' ? 'All Items' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
              {filtered.map((item) => {
                const inCartQty = getCartQty(item.product_id);
                const outOfStock = item.quantity <= 0;
                const maxedOut = inCartQty >= item.quantity && !outOfStock;

                return (
                  <article
                    key={item.product_id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:p-5"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(item)}
                        className="relative mb-3 block w-full overflow-hidden rounded-xl bg-brand-50/70"
                      >
                        <img
                          src={item.image_url || FALLBACK_PRODUCT_IMAGE}
                          alt={item.product_name}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                          }}
                          className="aspect-[16/11] w-full object-cover transition duration-200 hover:scale-[1.03]"
                        />
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {item.category}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${getStockBadgeClasses(
                            item.stock_status
                          )}`}
                        >
                          {item.stock_status} ({item.quantity})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(item)}
                        className="mt-3 block text-left text-sm font-bold leading-snug text-slate-900 hover:text-brand-700 sm:text-base"
                      >
                        {item.product_name}
                      </button>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-extrabold text-slate-900 tabular-nums sm:text-lg">
                          {formatCurrency(item.price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(item)}
                          aria-label={`View details for ${item.product_name}`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock || maxedOut}
                        onClick={() => addToCart(item)}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {outOfStock
                            ? 'Unavailable'
                            : maxedOut
                              ? `Max (${inCartQty})`
                              : inCartQty > 0
                                ? `Add (${inCartQty})`
                                : 'Add to Cart'}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {cartPanelBody}
          </div>
        </aside>
      </div>

      {/* Product Detail Modal (Esc closes) */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedProduct.category}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockBadgeClasses(
                    selectedProduct.stock_status
                  )}`}
                >
                  {selectedProduct.stock_status} · {selectedProduct.quantity} left
                </span>
              </div>
              <button
                type="button"
                aria-label="Close product details"
                onClick={() => setSelectedProduct(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={selectedProduct.image_url || FALLBACK_PRODUCT_IMAGE}
              alt={selectedProduct.product_name}
              onError={(e) => {
                e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
              }}
              className="mt-3 aspect-[16/10] w-full rounded-2xl border border-slate-100 bg-brand-50/70 object-cover"
            />
            <h3 id="product-modal-title" className="mt-4 text-xl font-extrabold text-slate-900">
              {selectedProduct.product_name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {selectedProduct.description}
            </p>
            <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/70 p-3.5 text-xs text-brand-900">
              Paperless checkout issues a digital QR receipt and avoids thermal paper waste (estimate).
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(selectedProduct.price)}
              </span>
              <button
                type="button"
                disabled={
                  selectedProduct.quantity <= 0 ||
                  getCartQty(selectedProduct.product_id) >= selectedProduct.quantity
                }
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Plus className="h-4 w-4" />
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom-Sheet Cart */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs lg:hidden">
          <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl">
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-slate-300" />
            <button
              type="button"
              aria-label="Close Cart"
              onClick={onCloseMobileCart}
              className="absolute right-3 top-2.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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

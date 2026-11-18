import { useEffect, useState } from 'react';
import {
  Leaf,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  X,
} from './Icons';
import { api } from '../api';
import {
  formatCurrency,
  getStockBadgeClasses,
  mutateCart,
  type CartEntry,
} from '../utils/format';
import {
  calculateEcoMetrics,
  type CatalogItem,
  type DigitalReceiptView,
  type SafeUser,
} from '../../shared/types';

interface PosViewProps {
  catalog: CatalogItem[];
  customers: SafeUser[];
  onSaleCompleted: (receipt: DigitalReceiptView) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export function PosView({
  catalog,
  customers,
  onSaleCompleted,
  onNotify,
}: PosViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'In Stock' | 'Low Stock'>('ALL');
  const [posCart, setPosCart] = useState<CartEntry[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [mobileRegisterOpen, setMobileRegisterOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customers.length === 0) return;
    if (!customers.some((c) => c.account_id === selectedCustomerId)) {
      const preferred =
        customers.find((c) => c.username === 'walkin_customer') ?? customers[0];
      setSelectedCustomerId(preferred.account_id);
    }
  }, [customers, selectedCustomerId]);

  const filteredProducts = catalog.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.product_name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || p.stock_status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  function getPosQty(productId: number): number {
    return posCart.find((c) => c.product_id === productId)?.quantity ?? 0;
  }

  function addToPosCart(item: CatalogItem) {
    setPosCart((prev) => mutateCart(prev, item, item.product_id, 1, onNotify));
  }

  function updatePosQty(productId: number, delta: number) {
    const prod = catalog.find((p) => p.product_id === productId);
    setPosCart((prev) => mutateCart(prev, prod, productId, delta, onNotify));
  }

  async function handleCompletePosSale() {
    if (posCart.length === 0 || submitting || selectedCustomerId <= 0) return;
    setSubmitting(true);
    try {
      const receipt = await api.processSale({
        account_id: selectedCustomerId,
        lineItems: posCart,
        checkoutToken: crypto.randomUUID(),
      });
      setPosCart([]);
      setMobileRegisterOpen(false);
      onNotify(`POS Sale #${receipt.transaction_id} recorded! QR receipt generated.`);
      onSaleCompleted(receipt);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'POS sale failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const lineViews = posCart
    .map((entry) => {
      const product = catalog.find((p) => p.product_id === entry.product_id);
      return product ? { ...entry, product } : null;
    })
    .filter((v): v is { product_id: number; quantity: number; product: CatalogItem } => v !== null);

  const saleTotal = lineViews.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );
  const totalUnits = lineViews.reduce((sum, line) => sum + line.quantity, 0);
  const ecoPreview = calculateEcoMetrics(lineViews.length);

  const renderRegisterPanel = (selectId: string) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-brand-400" />
          <h3 className="text-base font-bold">Current Sale Register</h3>
        </div>
        {posCart.length > 0 && (
          <button
            type="button"
            onClick={() => setPosCart([])}
            className="text-xs font-medium text-slate-300 hover:text-white"
          >
            Clear Sale
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <label
          htmlFor={selectId}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
        >
          <UserCheck className="h-3.5 w-3.5 text-brand-600" />
          Customer Account Association
        </label>
        <select
          id={selectId}
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        >
          {customers.map((cust) => (
            <option key={cust.account_id} value={cust.account_id}>
              {cust.full_name} (@{cust.username})
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5 py-2 lg:max-h-80">
        {lineViews.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-500">No items added to register</p>
            <p className="mt-1 text-xs text-slate-500">
              Select products on the left to start ringing up a sale.
            </p>
          </div>
        ) : (
          lineViews.map(({ product, quantity }) => (
            <div key={product.product_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {product.product_name}
                </p>
                <p className="font-mono text-xs text-slate-500 tabular-nums">
                  {formatCurrency(product.price)} × {quantity} ={' '}
                  <strong className="text-slate-900">
                    {formatCurrency(product.price * quantity)}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    aria-label={`Decrease ${product.product_name}`}
                    onClick={() => updatePosQty(product.product_id, -1)}
                    className="p-2 text-slate-600 hover:text-slate-900"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[1.75rem] text-center font-mono text-xs font-bold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.product_name}`}
                    disabled={quantity >= product.quantity}
                    onClick={() => updatePosQty(product.product_id, 1)}
                    className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${product.product_name}`}
                  onClick={() =>
                    setPosCart((prev) => prev.filter((c) => c.product_id !== product.product_id))
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/90 p-5">
        {lineViews.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
            <span className="flex items-center gap-1.5 font-semibold">
              <Leaf className="h-3.5 w-3.5 text-brand-600" />
              Eco Estimate
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {ecoPreview.paper_saved.toFixed(2)} sh · {ecoPreview.carbon_reduction.toFixed(2)} g CO₂e
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-600">Sale Total</span>
          <span className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(saleTotal)}
          </span>
        </div>

        <button
          type="button"
          disabled={lineViews.length === 0 || submitting || selectedCustomerId <= 0}
          onClick={() => void handleCompletePosSale()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <QrCode className="h-4 w-4" />
          {submitting
            ? 'Completing Sale...'
            : 'Complete Sale and Generate QR Receipt'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="pb-20 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Admin Point of Sale</h2>
                <p className="text-xs text-slate-500">
                  Tap products to add them to the current sale register.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search POS products..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'In Stock', 'Low Stock'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL' ? 'All SKUs' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredProducts.map((item) => {
              const inSale = getPosQty(item.product_id);
              const disabled = item.quantity <= 0 || inSale >= item.quantity;

              return (
                <button
                  key={item.product_id}
                  type="button"
                  disabled={disabled}
                  onClick={() => addToPosCart(item)}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-brand-400 hover:bg-brand-50/30 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.product_name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStockBadgeClasses(
                        item.stock_status
                      )}`}
                    >
                      {item.quantity} left
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.description}</p>
                  <div className="mt-3 flex w-full items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="font-mono text-sm font-extrabold text-brand-700 tabular-nums">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {inSale > 0 ? `${inSale} in sale` : '+ Add item'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            {renderRegisterPanel('pos-customer-select')}
          </div>
        </aside>
      </div>

      {/* Mobile Floating Current Sale Trigger */}
      <div className="fixed inset-x-4 bottom-20 z-30 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileRegisterOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl"
        >
          <span className="flex items-center gap-2 text-xs font-bold">
            <ShoppingBag className="h-4 w-4 text-brand-400" />
            Current Sale ({totalUnits} items)
          </span>
          <span className="font-mono text-sm font-extrabold text-brand-300 tabular-nums">
            {formatCurrency(saleTotal)} · Open Register
          </span>
        </button>
      </div>

      {/* Mobile Bottom-Sheet POS Register */}
      {mobileRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-xs lg:hidden">
          <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close POS Register"
              onClick={() => setMobileRegisterOpen(false)}
              className="absolute right-4 top-3.5 z-10 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {renderRegisterPanel('pos-customer-select-mobile')}
          </div>
        </div>
      )}
    </div>
  );
}

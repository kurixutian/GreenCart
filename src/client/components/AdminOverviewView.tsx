import { AlertTriangle, Boxes, Leaf, QrCode, Store } from './Icons';
import { formatCurrency, getStockBadgeClasses } from '../utils/format';
import type { CatalogItem, EcoImpactSummary } from '../../shared/types';
import type { AdminSection } from './AdminShell';

interface AdminOverviewViewProps {
  catalog: CatalogItem[];
  ecoSummary: EcoImpactSummary | null;
  onNavigate: (section: AdminSection) => void;
  onInspectToken: (qrCode: string) => void;
}

export function AdminOverviewView({
  catalog,
  ecoSummary,
  onNavigate,
  onInspectToken,
}: AdminOverviewViewProps) {
  const lowOrOutItems = catalog.filter((i) => i.stock_status !== 'In Stock');
  const recentLedger = ecoSummary?.ledger.slice(0, 5) ?? [];
  const totalSalesAmount =
    ecoSummary?.ledger.reduce((sum, row) => sum + Number(row.total_amount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Operations Overview</h1>
          <p className="text-xs text-slate-500">
            Live summary sourced directly from inventory, transactions, digital receipts, and eco-impact records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            <Store className="h-4 w-4" />
            Open POS Terminal
          </button>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <Boxes className="h-4 w-4" />
            Manage Stock
          </button>
        </div>
      </div>

      {/* Operational KPI Strip (strictly persisted totals) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Recorded Transactions</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
            {ecoSummary?.paperless_count ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Paperless receipts issued</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Recorded Sales Volume</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(totalSalesAmount)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Sum of completed transactions</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <span className="text-xs font-semibold text-amber-800">Stock Attention Needed</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-amber-900 tabular-nums">
            {lowOrOutItems.length}
          </p>
          <p className="mt-1 text-[11px] text-amber-700">Low-stock or out-of-stock SKUs</p>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-800">Paper Saved (Est.)</span>
            <Leaf className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-brand-900 tabular-nums">
            {(ecoSummary?.total_paper_saved ?? 0).toFixed(2)} sh
          </p>
          <p className="mt-1 text-[11px] text-brand-700">
            ~{(ecoSummary?.total_carbon_reduction ?? 0).toFixed(2)} g CO₂e avoided
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Low / Out of Stock Attention Queue */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Inventory Alerts</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {lowOrOutItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                All SKUs are healthy (&gt;10 units in stock).
              </p>
            ) : (
              lowOrOutItems.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {item.product_name}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      Qty remaining: {item.quantity}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getStockBadgeClasses(
                      item.stock_status
                    )}`}
                  >
                    {item.stock_status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent Paperless Transactions</h2>
            <button
              type="button"
              onClick={() => onNavigate('receipt')}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Lookup QR Token
            </button>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {recentLedger.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No sales recorded yet.</p>
            ) : (
              recentLedger.map((tx) => (
                <div
                  key={tx.transaction_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      #{tx.transaction_id}
                    </span>
                    <span className="ml-2 font-medium text-slate-700">{tx.customer_name}</span>
                    <span className="block text-[11px] text-slate-500">{tx.transaction_date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatCurrency(tx.total_amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectToken(tx.qr_code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                    >
                      <QrCode className="h-3 w-3" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

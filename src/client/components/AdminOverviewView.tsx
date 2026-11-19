import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, Leaf, QrCode, ScrollText, Search, Store, X } from './Icons';
import { api } from '../api';
import { formatCurrency, getStockBadgeClasses } from '../utils/format';
import type {
  AdminTransactionItem,
  AdminTransactionSort,
  CatalogItem,
  EcoImpactSummary,
  SafeUser,
} from '../../shared/types';
import type { AdminSection } from './AdminShell';

interface AdminOverviewViewProps {
  catalog: CatalogItem[];
  customers: SafeUser[];
  ecoSummary: EcoImpactSummary | null;
  onNavigate: (section: AdminSection) => void;
  onInspectToken: (qrCode: string) => void;
}

export function AdminOverviewView({
  catalog,
  customers,
  ecoSummary,
  onNavigate,
  onInspectToken,
}: AdminOverviewViewProps) {
  const [txSearch, setTxSearch] = useState('');
  const [txCustomerId, setTxCustomerId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txSort, setTxSort] = useState<AdminTransactionSort>('newest');
  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  const txFilters = {
    search: txSearch.trim() || undefined,
    customerAccountId: txCustomerId === 'ALL' ? undefined : Number(txCustomerId),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort: txSort,
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingTx(true);
    setTxError(null);
    api
      .getAdminTransactions({
        search: txSearch.trim() || undefined,
        customerAccountId: txCustomerId === 'ALL' ? undefined : Number(txCustomerId),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort: txSort,
      })
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setTxError(err instanceof Error ? err.message : 'Failed to load transactions.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [txSearch, txCustomerId, dateFrom, dateTo, txSort, ecoSummary?.paperless_count]);

  const hasFilters = Boolean(
    txSearch.trim() || txCustomerId !== 'ALL' || dateFrom || dateTo || txSort !== 'newest'
  );

  const lowOrOutItems = catalog.filter(
    (i) => !i.is_archived && i.stock_status !== 'In Stock'
  );
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
            ~{(ecoSummary?.total_carbon_reduction ?? 0).toFixed(2)} g CO₂e avoided (est.)
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
              <p className="py-6 text-center text-xs text-slate-600">
                All active SKUs are above their reorder threshold.
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
                    <p className="font-mono text-[11px] text-slate-600">
                      Qty: {item.quantity} (Reorder &le; {item.reorder_level})
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

        {/* Searchable Admin Transactions & Receipt Discovery (Phase 4) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Store Transactions &amp; Receipt Lookup
              </h2>
              <p className="text-[11px] text-slate-600">
                {loadingTx
                  ? 'Searching persisted transactions...'
                  : `${transactions.length} matching transaction${transactions.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={api.getTransactionsExportUrl(txFilters)}
                download="greencart-transactions.csv"
                onClick={(e) => {
                  if (api.isStaticDemoMode()) {
                    e.preventDefault();
                    api.downloadDemoTransactionsCsv(txFilters);
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <ScrollText className="h-3.5 w-3.5 text-slate-600" />
                Export CSV
              </a>
              <button
                type="button"
                onClick={() => onNavigate('receipt')}
                className="min-h-9 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:underline"
              >
                Lookup QR Token
              </button>
            </div>
          </div>

          {/* Search, Customer, Date Range & Sort Filters */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-tx-search"
                type="text"
                aria-label="Search transactions by ID, QR token, or customer"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search tx #, QR token, customer..."
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs outline-none focus:border-brand-500 focus:bg-white"
              />
              {txSearch && (
                <button
                  type="button"
                  aria-label="Clear transaction search"
                  onClick={() => setTxSearch('')}
                  className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <select
                id="admin-tx-customer"
                aria-label="Filter transactions by customer"
                value={txCustomerId}
                onChange={(e) => setTxCustomerId(e.target.value)}
                className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
              >
                <option value="ALL">All Customers</option>
                {customers.map((c) => (
                  <option key={c.account_id} value={String(c.account_id)}>
                    {c.full_name} (@{c.username})
                  </option>
                ))}
              </select>

              <select
                id="admin-tx-sort"
                aria-label="Sort transactions"
                value={txSort}
                onChange={(e) => setTxSort(e.target.value as AdminTransactionSort)}
                className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="highest">Highest ₱</option>
                <option value="lowest">Lowest ₱</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
              <span>From</span>
              <input
                type="date"
                aria-label="Transactions from date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
              <span>To</span>
              <input
                type="date"
                aria-label="Transactions to date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-brand-500"
              />
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setTxSearch('');
                  setTxCustomerId('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setTxSort('newest');
                }}
                className="ml-auto text-[11px] font-semibold text-brand-700 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Store transactions list"
            className="mt-3 max-h-[380px] divide-y divide-slate-100 overflow-y-auto pr-1 focus:outline-2 focus:outline-brand-600"
          >
            {txError ? (
              <p className="py-6 text-center text-xs text-rose-700">{txError}</p>
            ) : transactions.length === 0 && !loadingTx ? (
              <p className="py-6 text-center text-xs text-slate-600">
                No transactions match the current search and filter criteria.
              </p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.transaction_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">
                        #{tx.transaction_id}
                      </span>
                      <span className="font-semibold text-slate-800">{tx.customer_name}</span>
                      <span className="font-mono text-[11px] text-slate-600">
                        @{tx.customer_username}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span>{tx.transaction_date}</span>
                      <span>&middot;</span>
                      <span className="font-mono">{tx.qr_code}</span>
                      <span>&middot;</span>
                      <span>
                        {tx.total_units} unit{tx.total_units === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatCurrency(tx.total_amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectToken(tx.qr_code)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
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

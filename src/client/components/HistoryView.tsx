import { useState } from 'react';
import { History, QrCode, Receipt, Search } from './Icons';
import { formatCurrency } from '../utils/format';
import type { PurchaseHistoryItem } from '../../shared/types';

interface HistoryViewProps {
  history: PurchaseHistoryItem[];
  onViewReceipt: (qrCode: string) => void;
}

export function HistoryView({ history, onViewReceipt }: HistoryViewProps) {
  const [query, setQuery] = useState('');

  const filtered = history.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(row.transaction_id).includes(q) ||
      row.qr_code.toLowerCase().includes(q) ||
      row.transaction_date.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Purchase History</h2>
            <p className="text-xs text-slate-500">
              Showing only transactions owned by your authenticated customer account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search #ID or token..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
            {filtered.length}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {history.length === 0 ? 'No completed purchases yet' : 'No matching transactions'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {history.length === 0
              ? 'Checkout items from the catalog to generate your first paperless QR receipt.'
              : 'Try clearing your transaction search filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Transaction Cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => (
              <article
                key={row.transaction_id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm font-extrabold text-slate-900">
                      Transaction #{row.transaction_id}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{row.transaction_date}</p>
                  </div>
                  <span className="font-mono text-base font-extrabold text-brand-700 tabular-nums">
                    {formatCurrency(row.total_amount)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 font-mono text-[11px] font-medium text-brand-700">
                    {row.paper_saved.toFixed(2)} sh · {row.carbon_reduction.toFixed(2)} g CO₂e
                  </span>
                  <button
                    type="button"
                    onClick={() => onViewReceipt(row.qr_code)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    View Receipt
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Transaction</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Items</th>
                  <th className="px-4 py-3.5">Eco Estimate</th>
                  <th className="px-4 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.transaction_id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-slate-900">
                        #{row.transaction_id}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                        {row.qr_code}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">{row.transaction_date}</td>
                    <td className="px-4 py-4 text-xs text-slate-700">
                      {row.item_count} line{row.item_count === 1 ? '' : 's'} ({row.total_units} units)
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs font-medium text-brand-700">
                        {row.paper_saved.toFixed(2)} sh · {row.carbon_reduction.toFixed(2)} g CO₂e
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatCurrency(row.total_amount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewReceipt(row.qr_code)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-600 hover:text-white"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

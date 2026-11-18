import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  History,
  Leaf,
  Printer,
  QrCode,
  Search,
  ShoppingBag,
} from './Icons';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import type { DigitalReceiptView } from '../../shared/types';

interface ReceiptViewProps {
  activeReceipt: DigitalReceiptView | null;
  onSelectReceipt: (receipt: DigitalReceiptView) => void;
  recentTokens: string[];
  onNotify: (message: string, type?: 'success' | 'error') => void;
  onBackToShop?: () => void;
  onOpenHistory?: () => void;
}

export function ReceiptView({
  activeReceipt,
  onSelectReceipt,
  recentTokens,
  onNotify,
  onBackToShop,
  onOpenHistory,
}: ReceiptViewProps) {
  const [tokenInput, setTokenInput] = useState(activeReceipt?.qr_code ?? '');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeReceipt) {
      setQrDataUrl('');
      return;
    }
    setTokenInput(activeReceipt.qr_code);
    const receiptUrl = `${window.location.origin}/?receipt=${encodeURIComponent(
      activeReceipt.qr_code
    )}`;
    QRCode.toDataURL(receiptUrl, {
      width: 210,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [activeReceipt]);

  async function lookupToken(token: string) {
    const clean = token.trim();
    if (!clean) return;
    setLoading(true);
    try {
      const receipt = await api.getReceiptByToken(clean);
      onSelectReceipt(receipt);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Receipt lookup failed.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void lookupToken(tokenInput);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Digital Receipt &amp; QR Verification</h2>
            <p className="text-xs text-slate-500">
              Scan or enter an opaque receipt token (e.g. <span className="font-mono">GC-7D30B59E42A1</span>) to verify a paperless transaction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onBackToShop && (
              <button
                type="button"
                onClick={onBackToShop}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Back to Catalog / POS
              </button>
            )}
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <History className="h-3.5 w-3.5" />
                Purchase History
              </button>
            )}
            {activeReceipt && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter QR receipt token (e.g. GC-7D30B59E42A1)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 font-mono text-sm uppercase outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" />
            {loading ? 'Verifying...' : 'Verify Receipt Token'}
          </button>
        </form>

        {recentTokens.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Quick tokens:</span>
            {recentTokens.map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => void lookupToken(tok)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
                  activeReceipt?.qr_code === tok
                    ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {tok}
              </button>
            ))}
          </div>
        )}
      </section>

      {!activeReceipt ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <QrCode className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No receipt selected</p>
          <p className="mt-1 text-xs text-slate-500">
            Complete a checkout or enter a valid QR receipt token above.
          </p>
        </div>
      ) : (
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 print:rounded-none print:border-slate-400 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-6 py-5 text-white print:bg-white print:text-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-500/20 p-2.5 text-brand-400 print:border print:border-slate-300 print:bg-white print:text-brand-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-300 print:text-brand-700">
                  GreenCart Paperless Receipt
                </p>
                <h3 className="text-lg font-bold">
                  Transaction #{activeReceipt.transaction_id}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-lg bg-white/10 px-3 py-1 font-mono text-xs font-semibold tracking-wider text-brand-200 print:border print:border-slate-300 print:text-slate-800">
                {activeReceipt.qr_code}
              </span>
              <p className="mt-1 text-xs text-slate-400 print:text-slate-600">
                {activeReceipt.receipt_date}
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-12">
            <div className="space-y-5 md:col-span-8">
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="block font-medium text-slate-500">Customer</span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                    {activeReceipt.customer_name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    @{activeReceipt.customer_username}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-slate-500">Receipt ID</span>
                  <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-900">
                    RCPT-{activeReceipt.receipt_id}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {activeReceipt.transaction_date}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Purchased Items
                </h4>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Product</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReceipt.items.map((line) => (
                        <tr key={line.detail_id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{line.product_name}</p>
                            <p className="font-mono text-xs text-slate-500 tabular-nums">
                              {formatCurrency(line.unit_price)} each
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                            {line.quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                            {formatCurrency(line.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50/70">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-sm font-bold text-slate-700">
                          Total Amount Paid
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-lg font-extrabold text-brand-700 tabular-nums">
                          {formatCurrency(activeReceipt.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 md:col-span-4">
              <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for receipt ${activeReceipt.qr_code}`}
                    className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xs"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
                    <QrCode className="h-12 w-12" />
                  </div>
                )}
                <p className="mt-3 break-all font-mono text-[11px] font-bold text-slate-800">
                  {activeReceipt.qr_code}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Opaque locator token generated locally with zero personal data encoded.
                </p>
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800">
                  <Leaf className="h-4 w-4 text-brand-600" />
                  Eco-Impact (Estimate)
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3 shadow-xs">
                    <span className="block text-[11px] text-slate-500">Paper Saved</span>
                    <span className="mt-0.5 block font-mono text-base font-extrabold text-brand-700 tabular-nums">
                      {activeReceipt.paper_saved.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">sheets</span>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-xs">
                    <span className="block text-[11px] text-slate-500">CO₂e Reduced</span>
                    <span className="mt-0.5 block font-mono text-base font-extrabold text-emerald-700 tabular-nums">
                      {activeReceipt.carbon_reduction.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500">grams CO₂e</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}

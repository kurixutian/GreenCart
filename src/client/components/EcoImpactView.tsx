import { CloudOff, FileCheck2, Info, Leaf, QrCode, ScrollText } from './Icons';
import { formatCurrency } from '../utils/format';
import {
  ECO_IMPACT_SPEC,
  type AccountType,
  type EcoImpactSummary,
  type EcoScope,
} from '../../shared/types';

interface EcoImpactViewProps {
  summary: EcoImpactSummary | null;
  scope: EcoScope;
  accountType: AccountType;
  onChangeScope: (scope: EcoScope) => void;
  onInspectToken: (qrCode: string) => void;
}

export function EcoImpactView({
  summary,
  scope,
  accountType,
  onChangeScope,
  onInspectToken,
}: EcoImpactViewProps) {
  const spec = summary?.specification ?? ECO_IMPACT_SPEC;
  const paperSaved = summary?.total_paper_saved ?? 0;
  const nextMilestone = paperSaved < 10 ? 10 : paperSaved < 25 ? 25 : paperSaved < 50 ? 50 : 100;
  const progressPct = Math.min(100, Math.round((paperSaved / nextMilestone) * 100));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-100 p-3 text-brand-700">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Eco-Impact Dashboard</h2>
            <p className="text-xs text-slate-600">
              Reconciled from persisted <span className="font-mono">eco_impact</span> and{' '}
              <span className="font-mono">digital_receipts</span> records.
            </p>
          </div>
        </div>

        {accountType === 'customer' ? (
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onChangeScope('personal')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                scope === 'personal'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Personal Impact
            </button>
            <button
              type="button"
              onClick={() => onChangeScope('store')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                scope === 'store'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Store-Wide Totals
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200">
            Scope: Store-Wide Totals
          </span>
        )}
      </div>

      {/* Three Core Wireframe Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-white to-brand-50/70 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Paper Saved (Estimate)
            </span>
            <ScrollText className="h-5 w-5 text-brand-600" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary ? summary.total_paper_saved.toFixed(2) : '0.00'}
          </p>
          <p className="mt-1 text-xs text-slate-600">thermal receipt sheets estimated avoided</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Carbon Reduction (Estimate)
            </span>
            <CloudOff className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary ? summary.total_carbon_reduction.toFixed(2) : '0.00'}
          </p>
          <p className="mt-1 text-xs text-slate-600">grams CO₂e estimated avoided</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Paperless Transactions
            </span>
            <FileCheck2 className="h-5 w-5 text-slate-600" />
          </div>
          <p className="mt-3 font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary ? summary.paperless_count : 0}
          </p>
          <p className="mt-1 text-xs text-slate-600">QR-backed digital receipts issued</p>
        </div>
      </div>

      {/* Cumulative Impact Progress Indicator */}
      <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-800">
            Cumulative Paper-Saving Milestone ({summary?.scope === 'store' ? 'Store-Wide' : 'Personal'} Estimate)
          </span>
          <span className="font-mono font-semibold text-brand-700 tabular-nums">
            {paperSaved.toFixed(2)} / {nextMilestone} sheets ({progressPct}%)
          </span>
        </div>
        <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Formula Disclosure Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-xs text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <div className="space-y-1.5">
          <p className="font-semibold">Documented Estimation Methodology</p>
          <p className="text-sky-900">
            {summary?.formula_note ?? spec.formula_note} Figures are project estimates derived from
            persisted database records, not laboratory emission measurements.
          </p>
          <p className="text-[11px] text-sky-900">
            <span className="font-semibold">Approved Metrics (Estimate &amp; Count Scope):</span>{' '}
            {spec.metrics
              .map(
                (m) =>
                  `${m.label} (${m.unit}, ${m.is_estimate ? 'Estimate' : 'Recorded Count'}) [${m.documented_in.join(', ')}]`
              )
              .join(' · ')}
          </p>
          <p className="text-[11px] font-medium text-sky-900">{spec.pending_approval_note}</p>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">
            Eco-Impact Transaction Breakdown ({summary?.scope === 'store' ? 'Store-Wide' : 'Personal'})
          </h3>
        </div>
        <div
          className="overflow-x-auto focus:outline-2 focus:outline-brand-600"
          tabIndex={0}
          role="region"
          aria-label="Eco-Impact Transaction Breakdown"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Transaction</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paper Saved (Est.)</th>
                <th className="px-5 py-3 text-right">CO₂e Reduced (Est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!summary || summary.ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500">
                    No Eco-Impact records found for this scope yet.
                  </td>
                </tr>
              ) : (
                summary.ledger.map((row) => (
                  <tr key={row.transaction_id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-semibold text-slate-900">
                        #{row.transaction_id}
                      </span>
                      {accountType === 'admin' && (
                        <button
                          type="button"
                          onClick={() => onInspectToken(row.qr_code)}
                          className="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-brand-100 hover:text-brand-800"
                        >
                          <QrCode className="h-3 w-3" />
                          {row.qr_code}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                      {row.customer_name}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{row.transaction_date}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums">
                      {formatCurrency(row.total_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-brand-700 tabular-nums">
                      {row.paper_saved.toFixed(2)} sh
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {row.carbon_reduction.toFixed(2)} g
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Database, RotateCcw, X } from './Icons';
import { api } from '../api';
import type { DatabaseSnapshot } from '../../shared/types';

interface DbInspectorModalProps {
  open: boolean;
  onClose: () => void;
  onAfterReset: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

type EntityKey = keyof DatabaseSnapshot;

const ENTITIES: Array<{ key: EntityKey; label: string }> = [
  { key: 'accounts', label: 'accounts' },
  { key: 'products', label: 'products' },
  { key: 'inventory', label: 'inventory' },
  { key: 'transactions', label: 'transactions' },
  { key: 'transaction_details', label: 'transaction_details' },
  { key: 'digital_receipts', label: 'digital_receipts' },
  { key: 'eco_impact', label: 'eco_impact' },
];

export function DbInspectorModal({
  open,
  onClose,
  onAfterReset,
  onNotify,
}: DbInspectorModalProps) {
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [activeEntity, setActiveEntity] = useState<EntityKey>('products');
  const [loading, setLoading] = useState(false);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const data = await api.getDbSnapshot();
      setSnapshot(data);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to inspect DB.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadSnapshot();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  async function handleReset() {
    try {
      await api.resetDb();
      await loadSnapshot();
      await onAfterReset();
      onNotify('Database reset to canonical 7-entity seed state.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Reset failed.', 'error');
    }
  }

  if (!open) return null;

  const rows = snapshot ? (snapshot[activeEntity] as unknown as Array<Record<string, unknown>>) : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="db-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-brand-400" />
            <div>
              <h3 id="db-inspector-title" className="text-base font-bold">Seven-Entity SQLite Live Inspector</h3>
              <p className="text-xs text-slate-400">
                Inspecting live <span className="font-mono">node:sqlite</span> relational tables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleReset()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/30 sm:min-h-9"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Seed Data
            </button>
            <button
              type="button"
              aria-label="Close database inspector"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 px-6 py-3">
          {ENTITIES.map((ent) => {
            const count = snapshot ? snapshot[ent.key].length : 0;
            return (
              <button
                key={ent.key}
                type="button"
                onClick={() => setActiveEntity(ent.key)}
                className={`min-h-11 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition sm:min-h-9 ${
                  activeEntity === ent.key
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {ent.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading database snapshot...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No rows in {activeEntity}.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-mono font-semibold text-slate-600">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-3.5 py-2.5">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      {columns.map((col) => (
                        <td key={col} className="px-3.5 py-2.5 text-slate-700">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import {
  Boxes,
  Database,
  LayoutGrid,
  Leaf,
  LogOut,
  QrCode,
  Store,
} from './Icons';
import type { SafeUser } from '../../shared/types';

export type AdminSection = 'overview' | 'pos' | 'inventory' | 'receipt' | 'eco';

interface AdminShellProps {
  user: SafeUser;
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onOpenDbModal: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const ADMIN_NAV: Array<{ key: AdminSection; label: string; shortLabel: string; icon: typeof Store }> = [
  { key: 'overview', label: 'Dashboard', shortLabel: 'Home', icon: LayoutGrid },
  { key: 'pos', label: 'POS Terminal', shortLabel: 'POS', icon: Store },
  { key: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: Boxes },
  { key: 'receipt', label: 'Digital Receipts', shortLabel: 'Receipts', icon: QrCode },
  { key: 'eco', label: 'Eco-Impact', shortLabel: 'Impact', icon: Leaf },
];

export function AdminShell({
  user,
  activeSection,
  onNavigate,
  onOpenDbModal,
  onLogout,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 pb-20 text-slate-900 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-slate-950">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight">GreenCart Admin</span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                  Operator
                </span>
              </div>
              <p className="text-[11px] text-slate-400">POS &amp; Inventory Operations</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Admin Navigation">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Inspect 7-Entity Database"
              onClick={onOpenDbModal}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <Database className="h-3.5 w-3.5 text-brand-400" />
              <span className="hidden sm:inline">7-Entity DB</span>
            </button>

            <span className="hidden rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 lg:inline">
              {user.full_name}
            </span>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign Out"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>

      {/* Mobile Bottom Operational Nav */}
      <nav
        aria-label="Admin Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900 px-2 py-1.5 text-slate-300 md:hidden print:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.key)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-semibold transition ${
                  active ? 'bg-brand-600 text-white' : 'text-slate-400'
                }`}
              >
                <Icon className="mb-0.5 h-4 w-4" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

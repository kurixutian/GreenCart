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
  { key: 'pos', label: 'POS', shortLabel: 'POS', icon: Store },
  { key: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: Boxes },
  { key: 'receipt', label: 'Receipts', shortLabel: 'Receipts', icon: QrCode },
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
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/95 text-white backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-slate-950">
              <Store className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">GreenCart</span>
              <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/25">
                Admin
              </span>
            </div>
          </div>

          <nav
            className="hidden items-center gap-1 rounded-xl bg-slate-800/60 p-1 md:flex"
            aria-label="Admin Navigation"
          >
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-slate-400 xl:inline">{user.full_name}</span>
            <span className="hidden h-4 w-px bg-slate-800 xl:inline-block" aria-hidden="true" />

            <button
              type="button"
              aria-label="Inspect 7-Entity Database"
              title="Inspect 7-Entity Database"
              onClick={onOpenDbModal}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 sm:min-h-8 sm:min-w-0"
            >
              <Database className="h-3.5 w-3.5 text-brand-400" />
              <span className="hidden sm:inline">DB</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign Out"
              title="Sign Out"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-200 sm:min-h-8 sm:min-w-0"
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

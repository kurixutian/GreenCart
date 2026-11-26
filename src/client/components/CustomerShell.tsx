import type { ReactNode } from 'react';
import {
  History,
  Leaf,
  LogOut,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  UserCheck,
} from './Icons';
import type { SafeUser } from '../../shared/types';

export type CustomerSection = 'catalog' | 'receipt' | 'history' | 'eco';

interface CustomerShellProps {
  user: SafeUser;
  activeSection: CustomerSection;
  cartCount: number;
  onNavigate: (section: CustomerSection) => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const CUSTOMER_NAV: Array<{ key: CustomerSection; label: string; mobileLabel: string; icon: typeof ShoppingBag }> = [
  { key: 'catalog', label: 'Catalog', mobileLabel: 'Shop', icon: ShoppingBag },
  { key: 'history', label: 'Purchase History', mobileLabel: 'History', icon: History },
  { key: 'eco', label: 'Eco-Impact', mobileLabel: 'Eco-Impact', icon: Leaf },
  { key: 'receipt', label: 'Digital Receipt', mobileLabel: 'Receipt', icon: QrCode },
];

export function CustomerShell({
  user,
  activeSection,
  cartCount,
  onNavigate,
  onOpenCart,
  onOpenAccount,
  onLogout,
  children,
}: CustomerShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 via-white to-slate-50 pb-24 text-slate-900 md:pb-10">
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="flex min-w-0 items-center gap-2.5 text-left sm:gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-base font-extrabold tracking-tight text-slate-900">
                GreenCart
              </span>
              <span className="hidden text-[11px] font-medium text-brand-700 sm:block">
                Eco Market · Paperless Store
              </span>
            </div>
          </button>

          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Customer Navigation">
            {CUSTOMER_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Open shopping cart"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800 transition hover:bg-brand-100 sm:gap-2 sm:px-3.5"
            >
              <ShoppingCart className="h-4 w-4 text-brand-600" />
              <span>Cart</span>
              <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 font-mono text-[11px] text-white">
                {cartCount}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAccount}
              aria-label={`Account settings for ${user.full_name}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-200 sm:px-3"
            >
              <UserCheck className="h-4 w-4 text-brand-700" />
              <span className="hidden max-w-32 truncate sm:inline">{user.full_name}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign Out"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:px-3"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Customer Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-md md:hidden print:hidden"
      >
        <div className="grid grid-cols-5 items-center gap-1">
          {CUSTOMER_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.key)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl py-1.5 text-[10px] font-semibold transition ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                }`}
              >
                <Icon className="mb-0.5 h-4 w-4" />
                <span>{item.mobileLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenCart}
            className="relative flex min-h-11 flex-col items-center justify-center rounded-xl bg-brand-600 py-1.5 text-[10px] font-bold text-white shadow-xs"
          >
            <ShoppingCart className="mb-0.5 h-4 w-4" />
            <span>Cart ({cartCount})</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

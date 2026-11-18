import { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Database,
  History,
  Leaf,
  LogOut,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Store,
} from './components/Icons';
import type { CartEntry } from './utils/format';
import { api } from './api';
import { AuthView } from './components/AuthView';
import { CatalogView } from './components/CatalogView';
import { DbInspectorModal } from './components/DbInspectorModal';
import { EcoImpactView } from './components/EcoImpactView';
import { HistoryView } from './components/HistoryView';
import { InventoryView } from './components/InventoryView';
import { PosView } from './components/PosView';
import { ReceiptView } from './components/ReceiptView';
import type {
  CatalogItem,
  DigitalReceiptView,
  EcoImpactSummary,
  EcoScope,
  PurchaseHistoryItem,
  SafeUser,
} from '../shared/types';

type ActiveSection =
  | 'catalog'
  | 'receipt'
  | 'history'
  | 'eco'
  | 'pos'
  | 'inventory';

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function App() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [section, setSection] = useState<ActiveSection>('catalog');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [customers, setCustomers] = useState<SafeUser[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<DigitalReceiptView | null>(null);
  const [ecoScope, setEcoScope] = useState<EcoScope>('personal');
  const [ecoSummary, setEcoSummary] = useState<EcoImpactSummary | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadRoleData = useCallback(
    async (activeUser: SafeUser, targetScope: EcoScope) => {
      const cat = await api.getCatalog();
      setCatalog(cat);

      if (activeUser.account_type === 'customer') {
        const [hist, eco] = await Promise.all([
          api.getHistory(),
          api.getEcoImpact(targetScope),
        ]);
        setHistory(hist);
        setEcoSummary(eco);
        setCustomers([]);
        if (hist.length > 0) {
          const latestReceipt = await api.getReceiptByToken(hist[0].qr_code).catch(() => null);
          if (latestReceipt) setActiveReceipt((prev) => prev ?? latestReceipt);
        }
      } else {
        const [custs, eco] = await Promise.all([
          api.getCustomers(),
          api.getEcoImpact('store'),
        ]);
        setCustomers(custs);
        setEcoSummary(eco);
        setHistory([]);
      }
    },
    []
  );

  useEffect(() => {
    api
      .me()
      .then(async ({ user: currentUser }) => {
        if (currentUser) {
          setUser(currentUser);
          const defaultScope: EcoScope =
            currentUser.account_type === 'admin' ? 'store' : 'personal';
          setEcoScope(defaultScope);
          setSection(currentUser.account_type === 'admin' ? 'pos' : 'catalog');
          await loadRoleData(currentUser, defaultScope);

          const urlReceipt = new URLSearchParams(window.location.search).get('receipt');
          if (urlReceipt) {
            const found = await api.getReceiptByToken(urlReceipt).catch(() => null);
            if (found) {
              setActiveReceipt(found);
              setSection('receipt');
            }
          }
        }
      })
      .catch(() => {
        // Unauthenticated
      })
      .finally(() => setInitializing(false));
  }, [loadRoleData]);

  async function handleAuthenticated(nextUser: SafeUser) {
    setUser(nextUser);
    setCart([]);
    setActiveReceipt(null);
    const defaultScope: EcoScope = nextUser.account_type === 'admin' ? 'store' : 'personal';
    setEcoScope(defaultScope);
    setSection(nextUser.account_type === 'admin' ? 'pos' : 'catalog');
    await loadRoleData(nextUser, defaultScope);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setCart([]);
      setActiveReceipt(null);
      setCatalog([]);
      setHistory([]);
      setEcoSummary(null);
      setDbModalOpen(false);
      notify('Signed out.');
    }
  }

  async function handleSaleCompleted(receipt: DigitalReceiptView) {
    setActiveReceipt(receipt);
    setSection('receipt');
    if (user) {
      await loadRoleData(user, ecoScope);
    }
  }

  async function handleViewReceiptByTx(transactionId: number) {
    try {
      const receipt = await api.getReceiptByTransactionId(transactionId);
      setActiveReceipt(receipt);
      setSection('receipt');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to open receipt.', 'error');
    }
  }

  async function handleInspectToken(qrCode: string) {
    try {
      const receipt = await api.getReceiptByToken(qrCode);
      setActiveReceipt(receipt);
      setSection('receipt');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to open receipt.', 'error');
    }
  }

  async function handleScopeChange(nextScope: EcoScope) {
    setEcoScope(nextScope);
    try {
      const eco = await api.getEcoImpact(nextScope);
      setEcoSummary(eco);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load Eco-Impact.', 'error');
    }
  }

  const navItems: Array<{ key: ActiveSection; label: string; icon: typeof ShoppingBag }> =
    user?.account_type === 'admin'
      ? [
          { key: 'pos', label: 'POS Terminal', icon: Store },
          { key: 'inventory', label: 'Inventory', icon: Boxes },
          { key: 'receipt', label: 'QR Receipt View', icon: QrCode },
          { key: 'eco', label: 'Eco-Impact', icon: Leaf },
        ]
      : [
          { key: 'catalog', label: 'Catalog', icon: ShoppingBag },
          { key: 'receipt', label: 'Digital Receipt', icon: QrCode },
          { key: 'history', label: 'Purchase History', icon: History },
          { key: 'eco', label: 'Eco-Impact', icon: Leaf },
        ];

  const recentTokens =
    user?.account_type === 'customer'
      ? history.slice(0, 4).map((h) => h.qr_code)
      : (ecoSummary?.ledger.slice(0, 4).map((l) => l.qr_code) ?? []);

  const totalCartUnits = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      {user && (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-slate-900">
                    GreenCart
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      user.account_type === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-brand-100 text-brand-800'
                    }`}
                  >
                    {user.account_type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Paperless Retail &amp; Eco POS</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Utility Controls */}
            <div className="flex items-center gap-2">
              {user.account_type === 'customer' && (
                <button
                  type="button"
                  onClick={() => {
                    setSection('catalog');
                    setMobileCartOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 lg:hidden"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{totalCartUnits}</span>
                </button>
              )}

              {user.account_type === 'admin' && (
                <button
                  type="button"
                  onClick={() => setDbModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Database className="h-3.5 w-3.5 text-brand-600" />
                  <span className="hidden sm:inline">7-Entity DB</span>
                </button>
              )}

              <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs sm:flex">
                <span className="font-semibold text-slate-800">{user.full_name}</span>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {initializing ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Initializing GreenCart session...
          </div>
        ) : !user ? (
          <AuthView onAuthenticated={handleAuthenticated} onNotify={notify} />
        ) : section === 'catalog' && user.account_type === 'customer' ? (
          <CatalogView
            catalog={catalog}
            cart={cart}
            onChangeCart={setCart}
            onSaleCompleted={handleSaleCompleted}
            onNotify={notify}
            mobileCartOpen={mobileCartOpen}
            onCloseMobileCart={() => setMobileCartOpen(false)}
          />
        ) : section === 'receipt' ? (
          <ReceiptView
            activeReceipt={activeReceipt}
            onSelectReceipt={setActiveReceipt}
            recentTokens={recentTokens}
            onNotify={notify}
          />
        ) : section === 'history' && user.account_type === 'customer' ? (
          <HistoryView
            history={history}
            onViewReceipt={(txId) => void handleViewReceiptByTx(txId)}
          />
        ) : section === 'eco' ? (
          <EcoImpactView
            summary={ecoSummary}
            scope={ecoScope}
            accountType={user.account_type}
            onChangeScope={(next) => void handleScopeChange(next)}
            onInspectToken={(tok) => void handleInspectToken(tok)}
          />
        ) : section === 'pos' && user.account_type === 'admin' ? (
          <PosView
            catalog={catalog}
            customers={customers}
            onSaleCompleted={handleSaleCompleted}
            onNotify={notify}
          />
        ) : section === 'inventory' && user.account_type === 'admin' ? (
          <InventoryView
            catalog={catalog}
            onRefresh={async () => {
              await loadRoleData(user, ecoScope);
            }}
            onNotify={notify}
          />
        ) : null}
      </main>

      {/* Admin 7-Entity Database Inspector Modal */}
      {user?.account_type === 'admin' && (
        <DbInspectorModal
          open={dbModalOpen}
          onClose={() => setDbModalOpen(false)}
          onAfterReset={async () => {
            await loadRoleData(user, ecoScope);
          }}
          onNotify={notify}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xl ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-600 text-white'
              : 'border-brand-700 bg-slate-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
export default App;

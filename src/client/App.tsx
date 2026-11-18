import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { AdminOverviewView } from './components/AdminOverviewView';
import { AdminShell, type AdminSection } from './components/AdminShell';
import { AuthView } from './components/AuthView';
import { CatalogView } from './components/CatalogView';
import { CustomerShell, type CustomerSection } from './components/CustomerShell';
import { DbInspectorModal } from './components/DbInspectorModal';
import { EcoImpactView } from './components/EcoImpactView';
import { HistoryView } from './components/HistoryView';
import { InventoryView } from './components/InventoryView';
import { PosView } from './components/PosView';
import { ReceiptView } from './components/ReceiptView';
import type { CartEntry } from './utils/format';
import type {
  CatalogItem,
  DigitalReceiptView,
  EcoImpactSummary,
  EcoScope,
  PurchaseHistoryItem,
  SafeUser,
} from '../shared/types';

const CART_STORAGE_KEY = 'greencart_cart';
const IDLE_WARN_MS = 25 * 60 * 1000;
const IDLE_EXPIRE_MS = 30 * 60 * 1000;

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

function readStoredCart(): CartEntry[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CartEntry).product_id === 'number' &&
        typeof (item as CartEntry).quantity === 'number' &&
        (item as CartEntry).quantity > 0
    );
  } catch {
    return [];
  }
}

export function App() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [customerSection, setCustomerSection] = useState<CustomerSection>('catalog');
  const [adminSection, setAdminSection] = useState<AdminSection>('pos');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [customers, setCustomers] = useState<SafeUser[]>([]);
  const [cart, setCart] = useState<CartEntry[]>(() => readStoredCart());
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<DigitalReceiptView | null>(null);
  const [justCompletedReceipt, setJustCompletedReceipt] = useState(false);
  const [ecoScope, setEcoScope] = useState<EcoScope>('personal');
  const [ecoSummary, setEcoSummary] = useState<EcoImpactSummary | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback(
    (
      message: string,
      type: 'success' | 'error' = 'success',
      action?: { label: string; onClick: () => void }
    ) => {
      setToast({
        id: Date.now(),
        message,
        type,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
    },
    []
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage failures
    }
  }, [cart]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const syncReceiptUrl = useCallback((qrCode: string | null) => {
    const url = new URL(window.location.href);
    if (qrCode) {
      url.searchParams.set('receipt', qrCode);
    } else {
      url.searchParams.delete('receipt');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  const loadRoleData = useCallback(
    async (activeUser: SafeUser, targetScope: EcoScope) => {
      const cat = await api.getCatalog(
        '',
        'ALL',
        'ALL',
        activeUser.account_type === 'admin'
      );
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

  const handleLogout = useCallback(
    async (reasonMessage = 'Signed out.') => {
      try {
        await api.logout();
      } finally {
        setUser(null);
        setCart([]);
        setActiveReceipt(null);
        setJustCompletedReceipt(false);
        setCatalog([]);
        setHistory([]);
        setEcoSummary(null);
        setDbModalOpen(false);
        setIdleWarningOpen(false);
        syncReceiptUrl(null);
        notify(reasonMessage);
      }
    },
    [notify, syncReceiptUrl]
  );

  // Idle session monitoring (warn at 25m, expire at 30m)
  useEffect(() => {
    if (!user) return;
    let warnTimer: number | undefined;
    let expireTimer: number | undefined;

    const resetTimers = () => {
      window.clearTimeout(warnTimer);
      window.clearTimeout(expireTimer);
      warnTimer = window.setTimeout(() => setIdleWarningOpen(true), IDLE_WARN_MS);
      expireTimer = window.setTimeout(() => {
        void handleLogout('Your session expired after 30 minutes of inactivity.');
      }, IDLE_EXPIRE_MS);
    };

    const onActivity = () => {
      if (!idleWarningOpen) {
        resetTimers();
      }
    };

    resetTimers();
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    return () => {
      window.clearTimeout(warnTimer);
      window.clearTimeout(expireTimer);
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [user, idleWarningOpen, handleLogout]);

  async function handleStayLoggedIn() {
    try {
      await api.me();
      setIdleWarningOpen(false);
      notify('Session extended for 30 minutes.');
    } catch {
      await handleLogout('Your session has expired. Please sign in again.');
    }
  }

  useEffect(() => {
    api
      .me()
      .then(async ({ user: currentUser }) => {
        if (currentUser) {
          setUser(currentUser);
          const defaultScope: EcoScope =
            currentUser.account_type === 'admin' ? 'store' : 'personal';
          setEcoScope(defaultScope);
          setCustomerSection('catalog');
          setAdminSection('pos');
          await loadRoleData(currentUser, defaultScope);

          const urlReceipt = new URLSearchParams(window.location.search).get('receipt');
          if (urlReceipt) {
            const found = await api.getReceiptByToken(urlReceipt).catch(() => null);
            if (found) {
              setActiveReceipt(found);
              if (currentUser.account_type === 'admin') setAdminSection('receipt');
              else setCustomerSection('receipt');
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
    setActiveReceipt(null);
    setJustCompletedReceipt(false);
    setIdleWarningOpen(false);
    const defaultScope: EcoScope = nextUser.account_type === 'admin' ? 'store' : 'personal';
    setEcoScope(defaultScope);
    setCustomerSection('catalog');
    setAdminSection('pos');
    await loadRoleData(nextUser, defaultScope);
  }

  async function handleSaleCompleted(receipt: DigitalReceiptView) {
    setActiveReceipt(receipt);
    setJustCompletedReceipt(true);
    syncReceiptUrl(receipt.qr_code);
    if (user?.account_type === 'admin') setAdminSection('receipt');
    else setCustomerSection('receipt');
    if (user) {
      await loadRoleData(user, ecoScope);
    }
  }

  async function handleInspectToken(qrCode: string) {
    try {
      const receipt = await api.getReceiptByToken(qrCode);
      setActiveReceipt(receipt);
      setJustCompletedReceipt(false);
      syncReceiptUrl(receipt.qr_code);
      if (user?.account_type === 'admin') setAdminSection('receipt');
      else setCustomerSection('receipt');
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

  const recentTokens =
    user?.account_type === 'customer'
      ? history.slice(0, 4).map((h) => h.qr_code)
      : (ecoSummary?.ledger.slice(0, 4).map((l) => l.qr_code) ?? []);

  const totalCartUnits = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <>
      {initializing ? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Initializing GreenCart session...
        </div>
      ) : !user ? (
        <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
          <AuthView onAuthenticated={handleAuthenticated} onNotify={notify} />
        </main>
      ) : user.account_type === 'customer' ? (
        <CustomerShell
          user={user}
          activeSection={customerSection}
          cartCount={totalCartUnits}
          onNavigate={(sec) => {
            setCustomerSection(sec);
            if (sec !== 'receipt') syncReceiptUrl(null);
          }}
          onOpenCart={() => {
            setCustomerSection('catalog');
            setMobileCartOpen(true);
            syncReceiptUrl(null);
          }}
          onLogout={() => void handleLogout()}
        >
          {customerSection === 'catalog' && (
            <CatalogView
              catalog={catalog}
              cart={cart}
              onChangeCart={setCart}
              onSaleCompleted={handleSaleCompleted}
              onOpenCart={() => setMobileCartOpen(true)}
              onNotify={notify}
              mobileCartOpen={mobileCartOpen}
              onCloseMobileCart={() => setMobileCartOpen(false)}
            />
          )}
          {customerSection === 'receipt' && (
            <ReceiptView
              activeReceipt={activeReceipt}
              justCompleted={justCompletedReceipt}
              onSelectReceipt={(rec) => {
                setActiveReceipt(rec);
                setJustCompletedReceipt(false);
                syncReceiptUrl(rec.qr_code);
              }}
              recentTokens={recentTokens}
              onNotify={notify}
              onBackToShop={() => {
                syncReceiptUrl(null);
                setCustomerSection('catalog');
              }}
              onOpenHistory={() => {
                syncReceiptUrl(null);
                setCustomerSection('history');
              }}
            />
          )}
          {customerSection === 'history' && (
            <HistoryView
              history={history}
              onViewReceipt={(qrCode) => void handleInspectToken(qrCode)}
            />
          )}
          {customerSection === 'eco' && (
            <EcoImpactView
              summary={ecoSummary}
              scope={ecoScope}
              accountType="customer"
              onChangeScope={(next) => void handleScopeChange(next)}
              onInspectToken={(tok) => void handleInspectToken(tok)}
            />
          )}
        </CustomerShell>
      ) : (
        <AdminShell
          user={user}
          activeSection={adminSection}
          onNavigate={(sec) => {
            setAdminSection(sec);
            if (sec !== 'receipt') syncReceiptUrl(null);
          }}
          onOpenDbModal={() => setDbModalOpen(true)}
          onLogout={() => void handleLogout()}
        >
          {adminSection === 'overview' && (
            <AdminOverviewView
              catalog={catalog}
              ecoSummary={ecoSummary}
              onNavigate={setAdminSection}
              onInspectToken={(tok) => void handleInspectToken(tok)}
            />
          )}
          {adminSection === 'pos' && (
            <PosView
              catalog={catalog.filter((item) => !item.is_archived)}
              customers={customers}
              onSaleCompleted={handleSaleCompleted}
              onNotify={notify}
            />
          )}
          {adminSection === 'inventory' && (
            <InventoryView
              catalog={catalog}
              onRefresh={async () => {
                await loadRoleData(user, ecoScope);
              }}
              onNotify={notify}
            />
          )}
          {adminSection === 'receipt' && (
            <ReceiptView
              activeReceipt={activeReceipt}
              justCompleted={justCompletedReceipt}
              onSelectReceipt={(rec) => {
                setActiveReceipt(rec);
                setJustCompletedReceipt(false);
                syncReceiptUrl(rec.qr_code);
              }}
              recentTokens={recentTokens}
              onNotify={notify}
              onBackToShop={() => {
                syncReceiptUrl(null);
                setAdminSection('pos');
              }}
            />
          )}
          {adminSection === 'eco' && (
            <EcoImpactView
              summary={ecoSummary}
              scope={ecoScope}
              accountType="admin"
              onChangeScope={(next) => void handleScopeChange(next)}
              onInspectToken={(tok) => void handleInspectToken(tok)}
            />
          )}

          <DbInspectorModal
            open={dbModalOpen}
            onClose={() => setDbModalOpen(false)}
            onAfterReset={async () => {
              await loadRoleData(user, ecoScope);
            }}
            onNotify={notify}
          />
        </AdminShell>
      )}

      {/* Session Idle Warning Modal */}
      {idleWarningOpen && user && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 id="session-warning-title" className="text-base font-bold text-slate-900">
              Your session will expire in 5 minutes
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              For your security, inactive sessions expire automatically after 30 minutes.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleLogout('Signed out.')}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
              <button
                type="button"
                onClick={() => void handleStayLoggedIn()}
                className="min-h-11 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Stay logged in
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 right-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xl md:bottom-5 md:right-5 print:hidden ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-600 text-white'
              : 'border-brand-700 bg-slate-900 text-white'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand-500"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
export default App;

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

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function App() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [customerSection, setCustomerSection] = useState<CustomerSection>('catalog');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
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
    setCart([]);
    setActiveReceipt(null);
    const defaultScope: EcoScope = nextUser.account_type === 'admin' ? 'store' : 'personal';
    setEcoScope(defaultScope);
    setCustomerSection('catalog');
    setAdminSection('pos');
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
    if (user?.account_type === 'admin') setAdminSection('receipt');
    else setCustomerSection('receipt');
    if (user) {
      await loadRoleData(user, ecoScope);
    }
  }

  async function handleViewReceiptByTx(transactionId: number) {
    try {
      const receipt = await api.getReceiptByTransactionId(transactionId);
      setActiveReceipt(receipt);
      setCustomerSection('receipt');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to open receipt.', 'error');
    }
  }

  async function handleInspectToken(qrCode: string) {
    try {
      const receipt = await api.getReceiptByToken(qrCode);
      setActiveReceipt(receipt);
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
          onNavigate={setCustomerSection}
          onOpenCart={() => {
            setCustomerSection('catalog');
            setMobileCartOpen(true);
          }}
          onLogout={() => void handleLogout()}
        >
          {customerSection === 'catalog' && (
            <CatalogView
              catalog={catalog}
              cart={cart}
              onChangeCart={setCart}
              onSaleCompleted={handleSaleCompleted}
              onNotify={notify}
              mobileCartOpen={mobileCartOpen}
              onCloseMobileCart={() => setMobileCartOpen(false)}
            />
          )}
          {customerSection === 'receipt' && (
            <ReceiptView
              activeReceipt={activeReceipt}
              onSelectReceipt={setActiveReceipt}
              recentTokens={recentTokens}
              onNotify={notify}
              onBackToShop={() => setCustomerSection('catalog')}
              onOpenHistory={() => setCustomerSection('history')}
            />
          )}
          {customerSection === 'history' && (
            <HistoryView
              history={history}
              onViewReceipt={(txId) => void handleViewReceiptByTx(txId)}
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
          onNavigate={setAdminSection}
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
              catalog={catalog}
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
              onSelectReceipt={setActiveReceipt}
              recentTokens={recentTokens}
              onNotify={notify}
              onBackToShop={() => setAdminSection('pos')}
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

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 right-4 z-50 max-w-sm rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xl md:bottom-5 md:right-5 print:hidden ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-600 text-white'
              : 'border-brand-700 bg-slate-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
export default App;

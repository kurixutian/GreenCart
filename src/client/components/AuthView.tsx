import { useState, type FormEvent } from 'react';
import { Leaf, Lock, QrCode, ShieldCheck, ShoppingBag, UserPlus } from './Icons';
import { api } from '../api';
import type { SafeUser } from '../../shared/types';

interface AuthViewProps {
  onAuthenticated: (user: SafeUser) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export function AuthView({ onAuthenticated, onNotify }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { user } = await api.login(username, password);
      onNotify(`Signed in as ${user.full_name} (${user.account_type})`);
      onAuthenticated(user);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Login failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { user } = await api.register(username, password, fullName);
      onNotify(`Customer account created for ${user.full_name}`);
      onAuthenticated(user);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Registration failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(demoUser: string, demoPass: string) {
    setSubmitting(true);
    try {
      const { user } = await api.login(demoUser, demoPass);
      onNotify(`Signed in as ${user.full_name}`);
      onAuthenticated(user);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Demo login failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-6 sm:py-10">
      <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-12">
        <div className="flex flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-white lg:col-span-5 sm:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold tracking-wide text-brand-50 ring-1 ring-brand-400/30">
              <Leaf className="h-3.5 w-3.5" />
              PAPERLESS RETAIL &amp; POS
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight">GreenCart</h1>
            <p className="mt-3 text-sm leading-relaxed text-brand-50">
              Eco-friendly shopping portal and point-of-sale system connecting inventory,
              atomic transactions, QR digital receipts, and verified environmental estimates.
            </p>

            <div className="mt-8 space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-800 p-2">
                  <ShoppingBag className="h-4 w-4 text-brand-50" />
                </div>
                <div>
                  <p className="font-semibold">Customer Storefront &amp; Cart</p>
                  <p className="text-xs text-brand-50">
                    Search eco-products, check live stock, and get instant QR receipts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-800 p-2">
                  <QrCode className="h-4 w-4 text-brand-50" />
                </div>
                <div>
                  <p className="font-semibold">Atomic POS &amp; Paperless Receipts</p>
                  <p className="text-xs text-brand-50">
                    Single server-side transaction updates stock, receipts, and eco-impact.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-800 p-2">
                  <ShieldCheck className="h-4 w-4 text-brand-50" />
                </div>
                <div>
                  <p className="font-semibold">Role-Scoped Security</p>
                  <p className="text-xs text-brand-50">
                    Public registration creates customer accounts only; admin routes are protected server-side.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/15 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-50">
              Quick Demo Sign-In
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('maria_santos', 'customer123')}
                className="flex items-center justify-between rounded-xl bg-brand-800/80 px-3.5 py-2.5 text-left text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-brand-900 disabled:opacity-60"
              >
                <span>Maria Santos (Customer)</span>
                <span className="font-mono text-[11px] text-brand-100">maria_santos</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('juan_delacruz', 'customer123')}
                className="flex items-center justify-between rounded-xl bg-brand-800/80 px-3.5 py-2.5 text-left text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-brand-900 disabled:opacity-60"
              >
                <span>Juan Dela Cruz (Customer)</span>
                <span className="font-mono text-[11px] text-brand-100">juan_delacruz</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('admin_qcu', 'admin123')}
                className="flex items-center justify-between rounded-xl bg-slate-950/30 px-3.5 py-2.5 text-left text-xs font-medium ring-1 ring-white/20 transition hover:bg-slate-950/45 disabled:opacity-60"
              >
                <span>Store Administrator (POS)</span>
                <span className="font-mono text-[11px] text-amber-200">admin_qcu</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 lg:col-span-7 sm:p-10">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Customer
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your account role automatically routes you to the Customer Portal or Admin POS.
                </p>
                {api.isStaticDemoMode() && (
                  <p className="mt-2 inline-block rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    GitHub Pages Browser Demo Mode (persisted in local browser storage)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="login-username">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. maria_santos or admin_qcu"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                {submitting ? 'Signing In...' : 'Sign In to GreenCart'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Create Customer Account</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Public sign-up always provisions a{' '}
                  <span className="font-semibold text-brand-700">customer</span> account.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="reg-fullname">
                  Full Name
                </label>
                <input
                  id="reg-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Elena Reyes"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="reg-username">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="lowercase letters, numbers, underscores"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {submitting ? 'Creating Account...' : 'Create Customer Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Lock, LogOut, ShieldCheck, UserCheck, X } from './Icons';
import { api } from '../api';
import type { SafeUser } from '../../shared/types';

interface AccountModalProps {
  open: boolean;
  user: SafeUser;
  onClose: () => void;
  onUserUpdated: (user: SafeUser) => void;
  onLogout: () => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export function AccountModal({
  open,
  user,
  onClose,
  onUserUpdated,
  onLogout,
  onNotify,
}: AccountModalProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(user.full_name);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, user.full_name]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updateProfile(fullName);
      onUserUpdated(res.user);
      onNotify('Account display name updated.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Profile update failed.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      onNotify('New password and confirmation do not match.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify('Password updated successfully.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Password change failed.', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="account-modal-title" className="text-lg font-bold text-slate-900">
                Account Settings
              </h2>
              <p className="text-xs text-slate-600">
                Minimal account record · Only username, role, and display name stored.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close account settings"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Account Read-Only Identity */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
          <div>
            <span className="font-semibold text-slate-600">Username</span>
            <p className="font-mono text-sm font-bold text-slate-900">@{user.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 font-semibold capitalize text-brand-800">
              {user.account_type}
            </span>
            <span className="font-mono text-slate-600">ID #{user.account_id}</span>
          </div>
        </div>

        {/* Profile Display Name Update */}
        <form onSubmit={handleSaveProfile} className="mt-5 space-y-3 border-b border-slate-100 pb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Profile Name
          </h3>
          <div>
            <label
              htmlFor="account-fullname-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Display Name
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="account-fullname-input"
                type="text"
                minLength={2}
                maxLength={80}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="submit"
                disabled={savingProfile || fullName.trim() === user.full_name}
                className="min-h-11 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </div>
        </form>

        {/* Change Password */}
        <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-slate-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Change Password
            </h3>
          </div>
          <div>
            <label
              htmlFor="account-current-password"
              className="block text-xs font-semibold text-slate-700"
            >
              Current Password
            </label>
            <input
              id="account-current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="account-new-password"
                className="block text-xs font-semibold text-slate-700"
              >
                New Password (6+ chars)
              </label>
              <input
                id="account-new-password"
                type="password"
                minLength={6}
                maxLength={128}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="account-confirm-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Confirm New Password
              </label>
              <input
                id="account-confirm-password"
                type="password"
                minLength={6}
                maxLength={128}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

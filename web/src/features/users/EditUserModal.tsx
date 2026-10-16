// src/features/users/EditUserModal.tsx
import { useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import type { User, UpdateUserRequest, UserRole } from './types';
import { useLanguage } from '../../i18n/languagecontext';

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, payload: UpdateUserRequest) => Promise<unknown>;
}

type FieldErrors = Partial<Record<keyof UpdateUserRequest | 'detail', string>>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function EditUserModal({ user, isOpen, onClose, onSave }: EditUserModalProps) {
  const { translations: t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('officer');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-seed the fields whenever a different user is opened for editing.
  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setBadgeNumber(user.badge_number);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setErrors({});
  }, [user?.id]);

  if (!isOpen || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSave(user.id, {
        full_name: fullName,
        badge_number: badgeNumber,
        phone: phone.trim(),
        role,
      });
      onClose();
    } catch (err) {
      // DRF returns {"field": ["message"]} for validation errors.
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as Record<string, unknown>;
        const mapped: FieldErrors = {};
        for (const [field, messages] of Object.entries(body)) {
          const text = Array.isArray(messages) ? messages[0] : messages;
          if (typeof text === 'string') {
            mapped[field as keyof FieldErrors] = text;
          }
        }
        setErrors(mapped);
      } else {
        setErrors({ detail: t.common.serverProblem });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm lg:text-base border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden text-slate-800">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e8edf6] text-[#1F3864] flex items-center justify-center font-semibold text-sm shrink-0">
              {initials(user.full_name)}
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-bold text-slate-900 leading-tight">
                {t.users.editOfficer}
              </h2>
              <p className="text-xs lg:text-sm text-slate-500 mt-0.5">
                {t.common.badge} {user.badge_number} · {t.roles[user.role]}
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 my-5" />

          {errors.detail && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-4 py-2 mb-4">
              {errors.detail}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label={t.users.fullName} error={errors.full_name}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label={t.users.badgeNumber} error={errors.badge_number}>
              <input
                type="text"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label={t.users.phone} error={errors.phone}>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label={t.users.role} error={errors.role}>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={`${inputClass} bg-white text-slate-600`}
              >
                <option value="officer">{t.roles.officer}</option>
                <option value="dispatcher">{t.roles.dispatcher}</option>
                <option value="supervisor">{t.roles.supervisor}</option>
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-white border border-slate-200 text-slate-700 text-sm lg:text-base font-semibold px-5 py-2 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 text-white text-sm lg:text-base font-semibold px-5 py-2 rounded-md transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? t.users.saving : t.users.saveChanges}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs lg:text-sm font-semibold text-slate-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs lg:text-sm text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

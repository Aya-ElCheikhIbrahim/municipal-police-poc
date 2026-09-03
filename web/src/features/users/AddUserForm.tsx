import { useState } from 'react';
import { ApiError } from '../../shared/api/client';
import type { CreateUserRequest, UserRole, LanguageCode } from './types';

interface AddUserFormProps {
  onSubmit: (payload: CreateUserRequest) => Promise<unknown>;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CreateUserRequest | 'detail', string>>;

export function AddUserForm({ onSubmit, onCancel }: AddUserFormProps) {
  const [fullName, setFullName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [phone, setPhone] = useState('+961 ');
  const [role, setRole] = useState<UserRole>('officer');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('ar');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit({
        username,
        password,
        full_name: fullName,
        badge_number: badgeNumber,
        phone: phone.trim(),
        role,
        preferred_language: language,
      });
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
        setErrors({ detail: 'Could not create the user. Try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]';

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs p-8 max-w-2xl mx-auto mt-2">
      <h2 className="text-base font-bold text-slate-900 mb-6">Add user</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.detail && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {errors.detail}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <Field label="Full name" error={errors.full_name}>
            <input
              type="text"
              placeholder="Enter full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Badge number" error={errors.badge_number}>
            <input
              type="text"
              placeholder="e.g. 214"
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Phone" error={errors.phone}>
            <input
              type="text"
              placeholder="+961"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Role" error={errors.role}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={`${inputClass} bg-white text-slate-600`}
            >
              <option value="officer">Officer</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Username" error={errors.username}>
            <input
              type="text"
              placeholder="Used to sign in"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Temporary password" error={errors.password}>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              minLength={8}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Preferred language" error={errors.preferred_language}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className={`${inputClass} bg-white text-slate-600`}
            >
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 text-white text-xs font-semibold px-5 py-2.5 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            {isSubmitting ? 'Creating…' : 'Create user'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
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
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
    </div>
  );
}
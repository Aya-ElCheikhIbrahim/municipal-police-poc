// src/features/users/ResetPasswordModal.tsx
import React, { useState } from 'react';
import { useLanguage } from '../../i18n/languagecontext';
export interface User {
  id: string | number;
  name: string;
  badge: string;
  role: string;
}

interface ResetPasswordModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateCode: (userId: string | number) => Promise<{ code: string }>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  isOpen,
  onClose,
  onGenerateCode,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const { translations: t } = useLanguage();
  if (!isOpen || !user) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await onGenerateCode(user.id);
      // Adjust property key depending on your backend (e.g. data.code or data.reset_code)
      setCode(data.code || (data as any).reset_code); 
      setStep(2);
    } catch (err) {
      console.error('Failed to generate reset code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep(1);
    setCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden text-slate-800">
        
        {/* STEP 1: CONFIRM BEFORE GENERATING */}
        {step === 1 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-900">{t.resetCode.title}</h2>
            
            <div className="mb-1 font-semibold text-slate-900">{user.name}</div>
            <div className="text-sm text-slate-500 mb-4">
              {t.resetCode.badge} {user.badge} · {user.role}
            </div>

            <p className="text-sm text-slate-500 mb-6">
              {t.resetCode.validFor}
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
              >
                {t.resetCode.cancel}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1e293b] hover:bg-[#0f172a] rounded-md transition"
              >
                {loading ? t.resetCode.generating : t.resetCode.generate}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: THE CODE, SHOWN ONCE */}
        {step === 2 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6 text-slate-900">
              {t.resetCode.codeFor} {user.name}
            </h2>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center mb-4">
              <div className="text-3xl font-mono font-bold tracking-[0.25em] text-slate-800 select-all mb-2">
                {code}
              </div>
              <div className="text-xs font-semibold text-amber-600">
                {t.resetCode.expires}
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center mb-6">
              {t.resetCode.shownOnce}
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition"
              >
                {copied ? t.resetCode.copied : t.resetCode.copy}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1e293b] hover:bg-[#0f172a] rounded-md transition"
              >
                	{t.resetCode.done}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
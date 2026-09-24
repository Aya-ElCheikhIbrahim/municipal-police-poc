import { useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { useAuth } from './AuthContext';
import municipalPoliceLogo from '../../assets/policelogo.png';
import { useLanguage } from '../../i18n/languagecontext';

export function LoginPage() {
  const { login } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Invalid username or password'
            : err.message,
        );
      } else {
        setError('Cannot reach the server. Is the backend running?');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
  <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
<header
  dir="ltr"
  className="bg-[#1F3864] text-white px-6 py-3 shadow-sm relative flex items-center justify-center"
>
  <div className="font-semibold text-base lg:text-lg text-center">
    {language === 'ar'
      ? 'شرطة البلدية — العمليات'
      : 'Municipal Police — Operations'}
  </div>

  <button
    type="button"
    onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
    className="absolute right-6 top-1/2 -translate-y-1/2 w-16 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors cursor-pointer"
  >
    🌐 {language === 'en' ? 'AR' : 'EN'}
  </button>
</header>

    <main className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm border border-slate-200">
        <img
          src={municipalPoliceLogo}
          alt="Municipal Police Logo"
          className="w-20 h-20 object-contain mx-auto mb-4"
        />

        <h2 className="text-xl font-bold text-slate-900 text-center mb-1">
          {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
        </h2>

        <p className="text-sm text-slate-500 text-center mb-6">
          {language === 'ar'
            ? 'دخول غرفة العمليات والمشرف'
            : 'Dispatcher and supervisor access'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              {language === 'ar' ? 'اسم المستخدم' : 'Username'}
            </label>

            <input
              type="text"
              placeholder={
                language === 'ar'
                  ? 'أدخل اسم المستخدم'
                  : 'Enter your username'
              }
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>

            <input
              type="password"
              placeholder={
                language === 'ar'
                  ? 'أدخل كلمة المرور'
                  : 'Enter your password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-1 cursor-pointer"
          >
            {isSubmitting
              ? language === 'ar'
                ? 'جارٍ تسجيل الدخول…'
                : 'Signing in…'
              : language === 'ar'
                ? 'تسجيل الدخول'
                : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  </div>
);
}

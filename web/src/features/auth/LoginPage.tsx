import { useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { useAuth } from './AuthContext';
import municipalPoliceLogo from '../../assets/policelogo.png';

export function LoginPage() {
  const { login } = useAuth();

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
      <header className="bg-[#1F3864] text-white px-6 py-4 font-semibold text-xl sm:text-2xl shadow-sm text-center">
      Municipal Police — Operations
    </header>

      <main className="flex-1 flex items-center justify-center p-4">
  <div className="bg-white p-10 sm:p-12 rounded-xl shadow-lg w-full max-w-lg border border-slate-200">
    <img
      src={municipalPoliceLogo}
      alt="Municipal Police Logo"
      className="w-32 h-32 object-contain mx-auto mb-6"
    />
    <h2 className="text-3xl font-bold text-slate-900 text-center mb-2">Sign in</h2>
    <p className="text-base text-slate-500 text-center mb-10">
      Dispatcher and supervisor access
    </p>

    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-base font-semibold text-slate-600 mb-2">
          Username
        </label>
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
          required
        />
      </div>

      <div>
        <label className="block text-base font-semibold text-slate-600 mb-2">
          Password
        </label>
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 text-lg border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
          required
        />
      </div>

      {error && (
        <div className="text-base text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#1F3864] hover:bg-[#182c50] disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-lg text-lg transition-colors mt-2 cursor-pointer"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</main>
    </div>
  );
}
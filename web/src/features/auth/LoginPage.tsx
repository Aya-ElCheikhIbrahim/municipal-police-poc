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
      <header className="bg-[#1F3864] text-white px-6 py-3 font-semibold text-base lg:text-lg shadow-sm text-center">
      Municipal Police — Operations
    </header>

      <main className="flex-1 flex items-center justify-center p-4">
  <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm border border-slate-200">
    <img
      src={municipalPoliceLogo}
      alt="Municipal Police Logo"
      className="w-20 h-20 object-contain mx-auto mb-4"
    />
    <h2 className="text-xl font-bold text-slate-900 text-center mb-1">Sign in</h2>
    <p className="text-sm text-slate-500 text-center mb-6">
      Dispatcher and supervisor access
    </p>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">
          Username
        </label>
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">
          Password
        </label>
        <input
          type="password"
          placeholder="Enter your password"
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
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</main>
    </div>
  );
}
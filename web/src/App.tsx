import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import Dashboard from './MainDashboard';

function AppContent() {
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-9 h-9 border-3 border-slate-200 border-t-[#1F3864] rounded-full animate-spin"></div>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
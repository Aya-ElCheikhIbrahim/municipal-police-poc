import { useState } from 'react';
import municipalPoliceLogo from './assets/policelogo.png';
import { roleLabel } from './features/auth/types';
import { useAuth } from './features/auth/AuthContext';
import { UsersPage } from './features/users/UsersPage';
import { LiveMapPage } from './features/map/LiveMapPage';
import { MissionsPage } from './features/missions/MissionsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import {
  ConnectionOverlay,
  PanicOverlay,
  type PanicAlert,
} from './features/Demo states/panic';

// Type Definitions
type TabType = 'Live map' | 'Missions' | 'Reports' | 'Users';

export default function MainDashboard() {
  // Authentication State
  const { user, logout } = useAuth();

  // Navigation & Sub-view State
  const [activeTab, setActiveTab] = useState<TabType>('Live map');

  // Network & UI Demo States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);

  // Panic Demo State
  const [panics, setPanics] = useState<PanicAlert[]>([]);
  const [panicMenuOpen, setPanicMenuOpen] = useState<boolean>(false);
  const [panicMessage, setPanicMessage] = useState<string>('');

  const showPanicMessage = (message: string) => {
    setPanicMessage(message);

    setTimeout(() => {
      setPanicMessage('');
    }, 3000);
  };

  const triggerPanic = () => {
    const id = Date.now();
    const officerNumber = panics.length + 1;

    const newPanic: PanicAlert = {
      id,
      officer: {
        id,
        full_name: `Officer ${officerNumber}`,
        badge_number: `${100 + officerNumber}`,
      },
      shift: 1,
      latitude: '34.4333',
      longitude: '35.8333',
      accuracy_m: 5,
      battery_level: 80,
      triggered_at: new Date().toISOString(),
    };

    setPanics((prev) => [...prev, newPanic]);

    setIsLoading(false);
    setForceEmptyState(false);
    setIsConnectionLost(false);
    setPanicMenuOpen(false);
  };

const officerCancelPanic = (id: number) => {
  const panicToCancel = panics.find((panic) => panic.id === id);

  if (!panicToCancel) return;

  setPanics((prev) =>
    prev.filter((panic) => panic.id !== id)
  );

  showPanicMessage(
    `${panicToCancel.officer.full_name} cancelled the emergency alert.`
  );

  setPanicMenuOpen(false);
};

  const clearAllPanics = () => {
    if (panics.length === 0) return;

    setPanics([]);
    setPanicMenuOpen(false);
  };

  // ---------------------------------------------------------------------------
  // MAIN DASHBOARD VIEW
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header Navigation */}
      {/* Top Header Navigation */}
<header className="sticky top-0 z-50 bg-[#1F3864] text-white px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-between shadow-md">
    <div className="flex items-center gap-3 sm:gap-8 flex-wrap">
    <div className="flex items-center">
      <img
        src={municipalPoliceLogo}
        alt="Municipal Police Logo"
        className="w-10 h-10 sm:w-16 sm:h-16 min-w-8 min-h-8 object-contain"
      />
    </div>

    <nav className="flex items-center gap-1 bg-slate-800/40 p-1 sm:p-2 rounded-md text-sm sm:text-lg overflow-x-auto">
      {(
        ['Live map', 'Missions', 'Reports', 'Users'] as TabType[]
      ).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-2.5 sm:px-6 py-1.5 sm:py-3 rounded transition-all font-medium cursor-pointer whitespace-nowrap ${
            activeTab === tab
              ? 'bg-[#2E5496] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  </div>

  {/* Demo State Controls & User Info — wraps to its own row on mobile */}
  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 bg-slate-800/60 border border-slate-700 rounded-md px-2 sm:px-3 py-1.5 sm:py-2">
      <span className="text-[10px] sm:text-sm text-slate-400 font-semibold mr-1">
        DEMO STATES:
      </span>

      {/* Panic Dropdown */}
      <div className="relative">
        <button
          onClick={() => setPanicMenuOpen((prev) => !prev)}
          className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[10px] sm:text-sm font-bold transition-colors cursor-pointer ${
            panics.length > 0
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white'
          }`}
        >
          Panic{panics.length > 0 ? ` (${panics.length})` : ''} ▾
        </button>

        {panicMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[100]">
            <button
              onClick={triggerPanic}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              {' '}
              {panics.length > 0
                ? 'Trigger another panic'
                : 'Trigger panic'}
            </button>

            <div className="border-t border-slate-100">
              <div className="px-4 py-2.5 text-sm font-semibold text-slate-500">
                Officer cancelled panic
              </div>

              {panics.length === 0 ? (
                <div className="px-4 pb-2.5 text-xs text-slate-300">
                  No active panic alerts
                </div>
              ) : (
                panics.map((panic) => (
                  <button
                    key={panic.id}
                    onClick={() => officerCancelPanic(panic.id)}
                    className="w-full text-left px-5 py-2 text-sm hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                  >
                    {panic.officer.full_name}
                    <span className="text-xs text-slate-400 ml-2">
                      Badge {panic.officer.badge_number}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={clearAllPanics}
              disabled={panics.length === 0}
              className={`w-full text-left px-4 py-2.5 text-sm border-t border-slate-100 ${
                panics.length === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'hover:bg-slate-100 text-slate-600 cursor-pointer'
              }`}
            >
              Clear all panics
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setIsLoading(!isLoading);
          if (!isLoading) {
            setForceEmptyState(false);
            setPanics([]);
          }
        }}
        className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[10px] sm:text-sm font-medium transition-colors cursor-pointer ${
          isLoading
            ? 'bg-amber-500 text-slate-900 font-bold'
            : 'bg-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        Loading
      </button>

      <button
        onClick={() => {
          setForceEmptyState(!forceEmptyState);
          if (!forceEmptyState) {
            setIsLoading(false);
            setPanics([]);
          }
        }}
        className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[10px] sm:text-sm font-medium transition-colors cursor-pointer ${
          forceEmptyState
            ? 'bg-amber-500 text-slate-900 font-bold'
            : 'bg-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        Empty
      </button>

      <button
        onClick={() => {
          setIsConnectionLost(!isConnectionLost);
          if (!isConnectionLost) {
            setPanics([]);
          }
        }}
        className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[10px] sm:text-sm font-medium transition-colors cursor-pointer ${
          isConnectionLost
            ? 'bg-rose-600 text-white font-bold'
            : 'bg-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        Connection Lost
      </button>
    </div>

    <div className="flex items-center gap-2 sm:gap-3">
      <span className="text-slate-200 font-medium text-xs sm:text-lg truncate max-w-[100px] sm:max-w-none">
        {user
          ? `${user.full_name} · ${roleLabel(user.role)}`
          : ''}
      </span>

      <button
        onClick={logout}
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded text-xs sm:text-lg font-medium transition-colors ml-1 cursor-pointer"
      >
        Log out
      </button>
    </div>
  </div>
</header>

      {/* Officer Cancel Message */}
      {panicMessage && (
        <div className="fixed top-20 right-5 z-[200] bg-slate-900 text-white px-4 py-3.5 rounded-lg shadow-xl text-xs font-medium">
          {panicMessage}
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {isConnectionLost ? (
          <ConnectionOverlay
            isConnectionLost={isConnectionLost}
          />
        ) : (
          <>
            {activeTab === 'Users' && <UsersPage />}
            {activeTab === 'Reports' && <ReportsPage />}
            {activeTab === 'Live map' && <LiveMapPage />}
            {activeTab === 'Missions' && <MissionsPage />}
          </>
        )}

        <PanicOverlay
          panics={panics}
          onClose={(id) =>
            setPanics((prev) =>
              prev.filter((panic) => panic.id !== id)
            )
          }
          onLocate={() => setActiveTab('Live map')}
        />
      </div>
    </div>
  );
}
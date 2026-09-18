import { useState } from 'react';
import municipalPoliceLogo from './assets/policelogo.png';
import { roleLabel } from './features/auth/types';
import { useAuth } from './features/auth/AuthContext';
import { UsersPage } from './features/users/UsersPage';
import { LiveMapPage } from './features/map/LiveMapPage';
import { MissionsPage } from './features/missions/MissionsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ConnectionOverlay, PanicOverlay } from './features/Demo states/panic';
import { usePanicAlerts } from './features/panic/usePanicAlerts';

// Type Definitions
type TabType = 'Live map' | 'Missions' | 'Reports' | 'Users';

export default function MainDashboard() {
  // Authentication State
  const { user, logout } = useAuth();

  // Navigation & Sub-view State
  const [activeTab, setActiveTab] = useState<TabType>('Live map');

  // Network & UI Demo States
  // Disabled demo toggles, kept for later (see the commented buttons in the header).
  // const [isLoading, setIsLoading] = useState<boolean>(false);
  // const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost /*, setIsConnectionLost */] = useState<boolean>(false);

  // Panic — real alerts from the backend, §4.6/§4.7.
  const { alerts: panics, error: panicError, resolve: resolvePanic } = usePanicAlerts();
  const [panicMenuOpen, setPanicMenuOpen] = useState<boolean>(false);

  const resolvePanicFromMenu = (id: number) => {
    resolvePanic(id);
    setPanicMenuOpen(false);
  };

  // ---------------------------------------------------------------------------
  // MAIN DASHBOARD VIEW
  // ---------------------------------------------------------------------------

  return (
<div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-800">      {/* Top Header Navigation */}
      {/* Top Header Navigation */}
<header className="sticky top-0 z-50 bg-[#1F3864] text-white px-3 lg:px-6 py-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6 shadow-md">
    <div className="flex items-center gap-3 lg:gap-5 flex-wrap lg:flex-nowrap">
    <div className="flex items-center">
      <img
        src={municipalPoliceLogo}
        alt="Municipal Police Logo"
        className="w-9 h-9 lg:w-11 lg:h-11 shrink-0 object-contain"
      />
    </div>

    <nav className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-md text-sm lg:text-base overflow-x-auto">
      {(
        ['Live map', 'Missions', 'Reports', 'Users'] as TabType[]
      ).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-3 lg:px-4 py-1.5 rounded transition-all font-medium cursor-pointer whitespace-nowrap ${
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

  {/* Panic alerts & user info — wraps to its own row on mobile */}
  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:gap-3 text-xs">
      {/* Panic Dropdown */}
      <div className="relative">
        <button
          onClick={() => setPanicMenuOpen((prev) => !prev)}
          className={`px-3 py-1.5 rounded text-xs lg:text-sm font-bold transition-colors cursor-pointer ${
            panics.length > 0
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white'
          }`}
        >
          Panic{panics.length > 0 ? ` (${panics.length})` : ''} ▾
        </button>

        {panicMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[100]">
            <div className="px-4 py-2.5 text-sm font-semibold text-slate-500">
              Active panic alerts
            </div>

            {panicError ? (
              <div className="px-4 pb-2.5 text-xs text-amber-600">{panicError}</div>
            ) : panics.length === 0 ? (
              <div className="px-4 pb-2.5 text-xs text-slate-300">
                No active panic alerts
              </div>
            ) : (
              panics.map((panic) => (
                <div
                  key={panic.id}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-rose-50 flex items-center justify-between gap-2"
                >
                  <span>
                    {panic.officer.full_name}
                    <span className="text-xs text-slate-400 ml-2">
                      Badge {panic.officer.badge_number}
                    </span>
                  </span>
                  <button
                    onClick={() => resolvePanicFromMenu(panic.id)}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer shrink-0"
                  >
                    Resolve
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Demo toggles disabled for now; uncomment (and their state above) to bring them back.
      <button
        onClick={() => {
          setIsLoading(!isLoading);
          if (!isLoading) {
            setForceEmptyState(false);
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
        }}
        className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[10px] sm:text-sm font-medium transition-colors cursor-pointer ${
          isConnectionLost
            ? 'bg-rose-600 text-white font-bold'
            : 'bg-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        Connection Lost
      </button>
      */}

    <div className="flex items-center gap-2 sm:gap-3">
      <span className="text-slate-200 font-medium text-xs lg:text-sm truncate max-w-[140px] lg:max-w-[240px]">
        {user
          ? `${user.full_name} · ${roleLabel(user.role)}`
          : ''}
      </span>

      <button
        onClick={logout}
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-1.5 rounded text-xs lg:text-sm font-medium transition-colors ml-1 cursor-pointer"
      >
        Log out
      </button>
    </div>
  </div>
</header>

      {/* Main Content Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">        {isConnectionLost ? (
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
          onClose={(id) => resolvePanic(id)}
          onLocate={() => setActiveTab('Live map')}
        />
      </div>
    </div>
  );
}
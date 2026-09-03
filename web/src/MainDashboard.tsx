import { useState } from 'react';
import municipalPoliceLogo from './assets/policelogo.png';
import { roleLabel } from './features/auth/types';
import { useAuth } from './features/auth/AuthContext';
import { UsersPage } from './features/users/UsersPage';
import { LiveMapPage } from './features/map/LiveMapPage';
import { MissionsPage } from './features/missions/MissionsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ConnectionOverlay, PanicOverlay } from './features/Demo states/panic';

// Type Definitions
type TabType = 'Live map' | 'Missions' | 'Reports' | 'Users';

export default function MainDashboard() {
  // Authentication State
  const { user, logout } = useAuth();
  
  // Navigation & Sub-view State
  const [activeTab, setActiveTab] = useState<TabType>('Missions');

  // Network & UI Demo States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);
  const [isPanic, setIsPanic] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // MAIN DASHBOARD VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header Navigation */}
      <header className="bg-[#1F3864] text-white px-6 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-8">
          <div className="flex items-center">
            <img
              src={municipalPoliceLogo}
              alt="Municipal Police Logo"
              className="w-14 h-14 min-w-10 min-h-10 object-contain"
            />
          </div>

          <nav className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-md text-xs">
            {(['Live map', 'Missions', 'Reports', 'Users'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                }}
                className={`px-3 py-1.5 rounded transition-all font-medium cursor-pointer ${
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

        {/* Demo State Controls & User Info */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">DEMO STATES:</span>
            
            {/* Panic Trigger Button */}
            <button
              onClick={() => {
                setIsPanic(!isPanic);
                if (!isPanic) {
                  setIsLoading(false);
                  setForceEmptyState(false);
                  setIsConnectionLost(false);
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isPanic
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white'
              }`}
            >
              {isPanic ? 'Clear Panic' : 'Trigger Panic'}
            </button>

            <button
              onClick={() => {
                setIsLoading(!isLoading);
                if (!isLoading) {
                  setForceEmptyState(false);
                  setIsPanic(false);
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                isLoading ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => {
                setForceEmptyState(!forceEmptyState);
                if (!forceEmptyState) {
                  setIsLoading(false);
                  setIsPanic(false);
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                forceEmptyState ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Empty
            </button>
            <button
              onClick={() => {
                setIsConnectionLost(!isConnectionLost);
                if (!isConnectionLost) setIsPanic(false);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                isConnectionLost ? 'bg-rose-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Connection Lost
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">
              {user ? `${user.full_name} · ${roleLabel(user.role)}` : ''}
            </span>
            <button
              onClick={logout}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-2.5 py-1 rounded text-xs font-medium transition-colors ml-1 cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {isConnectionLost ? (
          <ConnectionOverlay isConnectionLost={isConnectionLost} />
        ) : (
          <>
            {activeTab === 'Users' && <UsersPage />}
            {activeTab === 'Reports' && <ReportsPage />}
            {activeTab === 'Live map' && <LiveMapPage />}
            {activeTab === 'Missions' && <MissionsPage />}
          </>
        )}

        {/* Panic Overlay Modal */}
        <PanicOverlay 
  isPanic={isPanic} 
  onClose={() => setIsPanic(false)} 
  onLocate={() => setActiveTab('Live map')} 
/>
      </div>
    </div>
  );
}
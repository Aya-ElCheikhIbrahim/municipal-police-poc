import { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import municipalPoliceLogo from './assets/policelogo.png';
import { roleLabel } from './features/auth/types';
import { useAuth } from './features/auth/AuthContext';
import { UsersPage } from './features/users/UsersPage';
import { LiveMapPage } from './features/map/LiveMapPage';
import { MissionsPage } from './features/missions/MissionsPage';
// Fix Leaflet's default icon paths in React/Vite bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Type Definitions
type TabType = 'Live map' | 'Missions' | 'Reports' | 'Users';
type ReportSubTab = 'Daily activity' | 'Weekly summary';
type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';



export default function MainDashboard() {
  // Dynamic Date Helpers
  const getFormattedToday = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('en-US', { month: 'short' });
    const year = today.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getFormattedWeekRange = () => {
    const today = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(today.getDate() - 6);

    const startDay = startOfWeek.getDate();
    const startMonth = startOfWeek.toLocaleString('en-US', { month: 'short' });

    const endDay = today.getDate();
    const endMonth = today.toLocaleString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startDay} – ${endDay} ${endMonth}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  };

  // Authentication State
  const { user, logout } = useAuth();
  
  // Navigation & Sub-view State
  const [activeTab, setActiveTab] = useState<TabType>('Missions');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('Daily activity');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  // Network & UI Demo States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);
  const [secondsDisconnected, setSecondsDisconnected] = useState<number>(47);


  // Connection Lost Disconnect Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnectionLost) {
      interval = setInterval(() => {
        setSecondsDisconnected((prev) => prev + 1);
      }, 1000);
    } else {
      setSecondsDisconnected(47);
    }
    return () => clearInterval(interval);
  }, [isConnectionLost]);

  


 

  // Daily Officers Activity Base Data
  const dailyOfficerData = [
    {
      name: 'Karim Haddad',
      dutyHours: '7h 42m',
      distance: '18.4 km',
      assigned: { ALL: 6, URGENT: 1, HIGH: 2, LOW: 3 },
      completed: { ALL: 5, URGENT: 1, HIGH: 2, LOW: 2 },
      cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
      panic: 1,
    },
    {
      name: 'Layla Mansour',
      dutyHours: '8h 01m',
      distance: '22.1 km',
      assigned: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
      completed: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
      cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
      panic: 0,
    },
    {
      name: 'Samir Youssef',
      dutyHours: '6h 30m',
      distance: '14.7 km',
      assigned: { ALL: 4, URGENT: 1, HIGH: 1, LOW: 2 },
      completed: { ALL: 3, URGENT: 1, HIGH: 0, LOW: 2 },
      cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      panic: 0,
    },
    {
      name: 'Nabil Khoury',
      dutyHours: '5h 15m',
      distance: '11.2 km',
      assigned: { ALL: 3, URGENT: 0, HIGH: 2, LOW: 1 },
      completed: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      panic: 0,
    },
  ];

  // Weekly Top Officers Data
  const weeklyOfficerData = [
    { name: 'Layla Mansour', completed: 28, avgTime: '31m' },
    { name: 'Karim Haddad', completed: 24, avgTime: '36m' },
    { name: 'Samir Youssef', completed: 19, avgTime: '42m' },
    { name: 'Nabil Khoury', completed: 14, avgTime: '47m' },
  ];





// Aggregate stats across active severity filter for top cards
  const summaryAssigned = dailyOfficerData.reduce((acc, row) => acc + row.assigned[severityFilter], 0);
  const summaryCompleted = dailyOfficerData.reduce((acc, row) => acc + row.completed[severityFilter], 0);

  // ---------------------------------------------------------------------------
  // 2. MAIN DASHBOARD VIEW
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
                  if (tab !== 'Missions') {
                  }
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
            
            <button
              onClick={() => {
                setIsLoading(!isLoading);
                if (!isLoading) setForceEmptyState(false);
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
                if (!forceEmptyState) setIsLoading(false);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                forceEmptyState ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Empty
            </button>
            <button
              onClick={() => setIsConnectionLost(!isConnectionLost)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                isConnectionLost ? 'bg-rose-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              Connection Lost
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">
              {user
                  ? `${user.full_name} · ${roleLabel(user.role)}`                : ''}
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
        {/* CONNECTION LOST OVERLAY */}
        {isConnectionLost ? (
          <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center relative w-full">
            <div className="absolute top-4 left-6 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              CONNECTION LOST
            </div>

            <div className="flex flex-col items-center justify-center max-w-md">
              <div className="w-9 h-9 border-3 border-slate-200 border-t-[#1F3864] rounded-full animate-spin mb-6"></div>

              <h2 className="text-base font-bold text-slate-900 mb-1.5">Reconnecting to the server</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Officer positions may be out of date. Last update {secondsDisconnected} seconds ago.
              </p>
            </div>
          </div>
        ) : (
          <>
          {/* USERS TAB VIEW */}
            {activeTab === 'Users' && <UsersPage />}

            {/* REPORTS TAB VIEW */}
            {activeTab === 'Reports' && (
              <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/80 p-0.5 rounded-md border border-slate-200 flex items-center">
                      <button
                        onClick={() => setReportSubTab('Daily activity')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          reportSubTab === 'Daily activity'
                            ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Daily activity
                      </button>
                      <button
                        onClick={() => setReportSubTab('Weekly summary')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          reportSubTab === 'Weekly summary'
                            ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Weekly summary
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-medium text-slate-700 shadow-xs">
                      {reportSubTab === 'Daily activity' ? getFormattedToday() : getFormattedWeekRange()}
                    </div>

                    {reportSubTab === 'Daily activity' && (
                      <div className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-medium text-slate-700 shadow-xs cursor-pointer">
                        All officers
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer">
                      Export CSV
                    </button>
                    <button className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer">
                      Export PDF
                    </button>
                  </div>
                </div>

                {reportSubTab === 'Daily activity' && (
                  <div className="space-y-4">
                    {/* Severity Filter Controls */}
                    <div className="flex items-center gap-2 bg-white/70 p-1 rounded-md border border-slate-200/70 w-fit shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 px-2 uppercase tracking-wide">
                        Severity Filter:
                      </span>
                      {(['ALL', 'URGENT', 'HIGH', 'LOW'] as SeverityFilter[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setSeverityFilter(level)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                            severityFilter === level
                              ? 'bg-[#1F3864] text-white shadow-xs'
                              : 'bg-transparent text-slate-600 hover:bg-slate-200/50'
                          }`}
                        >
                          {level === 'ALL' ? 'All' : level.charAt(0) + level.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">4</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Officers on duty</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">{summaryAssigned}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                          Missions assigned ({severityFilter.toLowerCase()})
                        </div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">{summaryCompleted}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Completed</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">1</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Panic events</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                            <th className="p-3.5">Officer</th>
                            <th className="p-3.5">Hours on duty</th>
                            <th className="p-3.5">Distance</th>
                            <th className="p-3.5">Assigned</th>
                            <th className="p-3.5">Completed</th>
                            <th className="p-3.5">Cancelled</th>
                            <th className="p-3.5">Panic</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {dailyOfficerData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 font-semibold text-slate-900">{row.name}</td>
                              <td className="p-3.5">{row.dutyHours}</td>
                              <td className="p-3.5">{row.distance}</td>
                              <td className="p-3.5 font-bold">{row.assigned[severityFilter]}</td>
                              <td className="p-3.5">{row.completed[severityFilter]}</td>
                              <td className="p-3.5">{row.cancelled[severityFilter]}</td>
                              <td className="p-3.5">{row.panic}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportSubTab === 'Weekly summary' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">96</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Total missions</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">4m 12s</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Avg acknowledgement</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">38m</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Avg completion</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
                        <div className="text-2xl font-bold text-slate-900">2</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">Panic events</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs space-y-4">
                        <h4 className="text-xs font-semibold text-slate-600">Missions by priority</h4>

                        <div className="space-y-3.5 text-xs">
                          <div>
                            <div className="flex justify-between text-slate-600 font-medium mb-1">
                              <span>Urgent</span>
                              <span className="font-bold text-slate-800">14</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-rose-600 h-2 rounded-full" style={{ width: '42%' }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-slate-600 font-medium mb-1">
                              <span>High</span>
                              <span className="font-bold text-slate-800">27</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-amber-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-slate-600 font-medium mb-1">
                              <span>Medium</span>
                              <span className="font-bold text-slate-800">33</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-[#1F3864] h-2 rounded-full" style={{ width: '100%' }}></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-slate-600 font-medium mb-1">
                              <span>Low</span>
                              <span className="font-bold text-slate-800">22</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-slate-400 h-2 rounded-full" style={{ width: '66%' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <h4 className="text-xs font-semibold text-slate-600 mb-3">Most missions completed</h4>

                        <div className="border border-slate-100 rounded-md overflow-hidden flex-1">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                                <th className="p-3">Officer</th>
                                <th className="p-3">Completed</th>
                                <th className="p-3">Avg time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {weeklyOfficerData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-900">{row.name}</td>
                                  <td className="p-3 font-medium">{row.completed}</td>
                                  <td className="p-3 text-slate-500">{row.avgTime}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            


            {/* LIVE MAP TAB */}
            {activeTab === 'Live map' && <LiveMapPage />}
          
        
        {/* MISSIONS TAB */}
            {activeTab === 'Missions' && <MissionsPage />}
       </>
       )}
      </div>
    </div>
  );
}

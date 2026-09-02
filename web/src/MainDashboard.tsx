import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import municipalPoliceLogo from './assets/policelogo.png';
import type { TabType, SystemUser, AuthUser, Officer, Mission } from './types';
import Missions from './Missions';
import Reports from './Reports';
import Users from './Users';
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function MainDashboard() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginError, setLoginError] = useState<string>('');
  const [_isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access');
    if (stored && token) {
      setCurrentUser(JSON.parse(stored));
      setIsAuthenticated(true);
    }
  }, []);

  // Navigation & Subviews
  const [activeTab, setActiveTab] = useState<TabType>('Missions');
  const [isCreatingMission, setIsCreatingMission] = useState<boolean>(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>('1');

  // Demo / Network UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);
  const [secondsDisconnected, setSecondsDisconnected] = useState<number>(47);

  // Emergency Panic Simulation
  const [isPanicActive, setIsPanicActive] = useState<boolean>(false);
  const [panicOfficer, setPanicOfficer] = useState<Officer | null>(null);

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

  // Shared Data States
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [usersList, setUsersList] = useState<SystemUser[]>([
    { id: '1', name: 'Karim Haddad', badge: '214', role: 'Officer', phone: '+961 70 111 222', status: 'Active' },
    { id: '2', name: 'Layla Mansour', badge: '187', role: 'Officer', phone: '+961 71 333 444', status: 'Active' },
    { id: '3', name: 'Rania Saab', badge: '102', role: 'Dispatcher', phone: '+961 76 555 666', status: 'Active' },
    { id: '4', name: 'Nabil Khoury', badge: '195', role: 'Officer', phone: '+961 78 777 888', status: 'Inactive' },
  ]);

  const [officers, setOfficers] = useState<Officer[]>([
    {
      id: '1',
      name: 'Karim Haddad',
      badge: 'Badge 214',
      status: 'On mission',
      details: '2h 14m · Rue Tall',
      dutyTime: '2h 14m',
      distanceCovered: '4.8 km',
      coords: [34.4367, 35.8497],
    },
    {
      id: '2',
      name: 'Layla Mansour',
      badge: 'Badge 187',
      status: 'Available',
      details: '3h 02m · Al Mina',
      dutyTime: '3h 02m',
      distanceCovered: '6.2 km',
      coords: [34.4482, 35.8201],
    },
    {
      id: '3',
      name: 'Samir Youssef',
      badge: 'Badge 226',
      status: 'Available',
      details: '1h 48m · Abou Samra',
      dutyTime: '1h 48m',
      distanceCovered: '3.1 km',
      coords: [34.4251, 35.8524],
    },
    {
      id: '4',
      name: 'Nabil Khoury',
      badge: 'Badge 195',
      status: 'Offline',
      details: 'shift ended 16:40',
      dutyTime: '0h 00m',
      distanceCovered: '0.0 km',
      coords: [34.4310, 35.8390],
    },
  ]);

  const [missions, setMissions] = useState<Mission[]>([
    {
      id: '1',
      title: 'Illegal parking blocking access',
      priority: 'Urgent',
      status: 'In progress',
      assignedTo: 'Karim Haddad',
      badge: '214',
      address: 'Rue Tall, Tripoli',
      created: '13:58',
      description: 'Vehicle parked across the entrance to the covered market. Owner not present.',
      officerNotes: 'Vehicle removed by owner after warning. Photographed before and after. No fine issued.',
      photos: ['14:31', '14:33', '14:36', '—'],
      lifecycle: [
        { label: 'Created', time: '13:58', subtext: 'Rania Saab', status: 'completed' },
        { label: 'Assigned', time: '13:59', subtext: 'to Karim Haddad', status: 'completed' },
        { label: 'Acknowledged', time: '14:02', subtext: '3 min response', status: 'completed' },
        { label: 'Started', time: '14:09', subtext: 'arrived on site', status: 'completed' },
        { label: 'In progress', subtext: '3 photos captured', status: 'active' },
        { label: 'Completed', subtext: 'Awaiting officer', status: 'pending' },
      ],
    },
    {
      id: '2',
      title: 'Street vendor obstruction',
      priority: 'High',
      status: 'Acknowledged',
      assignedTo: 'Layla Mansour',
      badge: '187',
      address: 'Al Mina, Tripoli',
      created: '13:30',
      description: 'Vendor blocking sidewalk near entrance.',
      officerNotes: 'Officer en route to location.',
      photos: ['—', '—', '—', '—'],
      lifecycle: [
        { label: 'Created', time: '13:30', subtext: 'Rania Saab', status: 'completed' },
        { label: 'Assigned', time: '13:32', subtext: 'to Layla Mansour', status: 'completed' },
        { label: 'Acknowledged', time: '13:35', subtext: '3 min response', status: 'active' },
        { label: 'Started', subtext: 'Pending arrival', status: 'pending' },
        { label: 'In progress', subtext: '0 photos captured', status: 'pending' },
        { label: 'Completed', subtext: 'Awaiting officer', status: 'pending' },
      ],
    },
  ]);

  // Live Map Refs
  const liveMapRef = useRef<HTMLDivElement | null>(null);
  const liveMapInstance = useRef<L.Map | null>(null);

  const handleTogglePanic = () => {
    if (isPanicActive) {
      setOfficers((prev) =>
        prev.map((o) => (o.id === panicOfficer?.id ? { ...o, status: 'On mission' } : o))
      );
      setIsPanicActive(false);
      setPanicOfficer(null);
    } else {
      const target = officers[0];
      setPanicOfficer(target);
      setOfficers((prev) =>
        prev.map((o) => (o.id === target.id ? { ...o, status: 'Panic' } : o))
      );
      setIsPanicActive(true);
      setSelectedOfficerId(target.id);
    }
  };

  // LEAFLET LIVE MAP INITIALIZATION
  useEffect(() => {
    if (activeTab !== 'Live map' || !liveMapRef.current || isConnectionLost || !isAuthenticated) {
      if (liveMapInstance.current) {
        liveMapInstance.current.remove();
        liveMapInstance.current = null;
      }
      return;
    }

    if (!liveMapInstance.current) {
      const map = L.map(liveMapRef.current, {
        center: [34.4367, 35.8497],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      liveMapInstance.current = map;
    }

    const timer = setTimeout(() => {
      liveMapInstance.current?.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab, isConnectionLost, isAuthenticated]);

  // LEAFLET LIVE MAP MARKERS & PAN
  useEffect(() => {
    if (activeTab !== 'Live map' || !liveMapInstance.current || isConnectionLost || !isAuthenticated) return;

    const map = liveMapInstance.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    officers.forEach((officer) => {
      const isSelected = selectedOfficerId === officer.id;
      const isPanic = officer.status === 'Panic';

      const colorClass = isPanic
        ? 'bg-rose-600 animate-ping'
        : officer.status === 'On mission'
        ? 'bg-[#2E5496]'
        : officer.status === 'Available'
        ? 'bg-[#2E7D32]'
        : 'bg-slate-400';

      const customHtml = `
        <div class="relative flex items-center justify-center">
          ${isPanic ? `<div class="absolute w-8 h-8 rounded-full bg-rose-500/50 animate-ping"></div>` : ''}
          <div class="w-5 h-5 rounded-full ${isPanic ? 'bg-rose-600' : colorClass} border-2 border-white shadow-md ${
        isSelected ? 'ring-4 ring-indigo-500/50 scale-125' : ''
      }"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: customHtml,
        className: 'custom-leaflet-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker(officer.coords, { icon: customIcon }).addTo(map);
      marker.on('click', () => setSelectedOfficerId(officer.id));
    });

    const activeOfficer = officers.find((o) => o.id === selectedOfficerId);
    if (activeOfficer) {
      map.panTo(activeOfficer.coords, { animate: true });
    }
  }, [activeTab, officers, selectedOfficerId, isConnectionLost, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setLoginError('Invalid username or password');
        return;
      }

      const data = await res.json();

      if (data.user.role === 'officer') {
        setLoginError('Officers must use the mobile app.');
        return;
      }

      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));

      setCurrentUser(data.user);
      setIsAuthenticated(true);
    } catch {
      setLoginError('Cannot reach the server. Is the backend running?');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  const selectedOfficer = officers.find((o) => o.id === selectedOfficerId);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
        <header className="bg-[#1F3864] text-white px-6 py-3 font-semibold text-lg shadow-sm">
          Municipal Police — Operations
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm border border-slate-200">
            <img
              src={municipalPoliceLogo}
              alt="Municipal Police Logo"
              className="w-24 h-24 object-contain mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-slate-900 text-center mb-1">Sign in</h2>
            <p className="text-xs text-slate-500 text-center mb-6">Dispatcher and supervisor access</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3864]/20 focus:border-[#1F3864]"
                  required
                />
              </div>
              {loginError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-[#1F3864] hover:bg-[#182c50] text-white font-medium py-2 rounded text-sm transition-colors mt-2 cursor-pointer"
              >
                Sign in
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // DASHBOARD LAYOUT
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
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
                  setIsAddingUser(false);
                  if (tab !== 'Missions') {
                    setIsCreatingMission(false);
                    setSelectedMissionId(null);
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

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">DEMO STATES:</span>
            <button
              onClick={handleTogglePanic}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isPanicActive
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white'
              }`}
            >
              {isPanicActive ? 'Clear Panic' : 'Trigger Panic'}
            </button>
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
              {currentUser
                ? `${currentUser.full_name} · ${currentUser.role.charAt(0).toUpperCase()}${currentUser.role.slice(1)}`
                : ''}
            </span>
            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-2.5 py-1 rounded text-xs font-medium transition-colors ml-1 cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {isPanicActive && panicOfficer && (
        <div className="bg-rose-600 text-white px-6 py-2.5 flex items-center justify-between shadow-lg border-b border-rose-700 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-extrabold text-sm uppercase tracking-wider">
              EMERGENCY PANIC ALERT: {panicOfficer.name} ({panicOfficer.badge})
            </span>
            <span className="text-xs bg-rose-700 px-2 py-0.5 rounded font-mono">
              Location: Rue Tall, Tripoli
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('Live map');
                setSelectedOfficerId(panicOfficer.id);
              }}
              className="bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold px-3 py-1 rounded transition-colors shadow-xs cursor-pointer"
            >
              Locate on Map
            </button>
            <button
              onClick={handleTogglePanic}
              className="bg-rose-800 hover:bg-rose-900 text-white text-xs font-semibold px-3 py-1 rounded border border-rose-500 transition-colors cursor-pointer"
            >
              Clear Alarm
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
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
            {activeTab === 'Users' && (
              <Users
                usersList={usersList}
                setUsersList={setUsersList}
                isAddingUser={isAddingUser}
                setIsAddingUser={setIsAddingUser}
              />
            )}

            {activeTab === 'Reports' && <Reports />}

            {activeTab === 'Missions' && (
              <Missions
                missions={missions}
                setMissions={setMissions}
                selectedMissionId={selectedMissionId}
                setSelectedMissionId={setSelectedMissionId}
                isCreatingMission={isCreatingMission}
                setIsCreatingMission={setIsCreatingMission}
                officers={officers}
                currentUser={currentUser}
                isLoading={isLoading}
                forceEmptyState={forceEmptyState}
                setForceEmptyState={setForceEmptyState}
                isConnectionLost={isConnectionLost}
                isAuthenticated={isAuthenticated}
              />
            )}

            {activeTab === 'Live map' && (
              <div className="flex-1 flex w-full">
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shadow-xs">
                  <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-xs text-slate-700">On duty</span>
                    <span className="text-xs text-slate-400 font-medium">{officers.length} officers</span>
                  </div>

                  <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                    {officers.map((officer) => (
                      <div
                        key={officer.id}
                        onClick={() => setSelectedOfficerId(officer.id)}
                        className={`p-3 transition-colors cursor-pointer ${
                          selectedOfficerId === officer.id
                            ? 'bg-slate-100 border-l-4 border-[#1F3864]'
                            : 'hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-900">{officer.name}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              officer.status === 'Panic'
                                ? 'bg-rose-600 text-white animate-pulse'
                                : officer.status === 'On mission'
                                ? 'bg-blue-50 text-blue-[#2E5496]'
                                : officer.status === 'Available'
                                ? 'bg-[#2E7D32]/10 text-[#2E7D32]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {officer.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {officer.badge} · {officer.details}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                <main className="flex-1 relative">
                  <div ref={liveMapRef} className="w-full h-full z-0" />
                </main>

                <aside className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between p-4 overflow-y-auto z-10 shadow-xs">
                  {selectedOfficer ? (
                    <div className="space-y-5">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{selectedOfficer.name}</h3>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{selectedOfficer.badge}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="text-lg font-bold text-slate-900">{selectedOfficer.dutyTime}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">On duty</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="text-lg font-bold text-slate-900">{selectedOfficer.distanceCovered}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Covered today</div>
                        </div>
                      </div>

                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setActiveTab('Missions');
                            setIsCreatingMission(true);
                          }}
                          className="w-full py-2 px-3 border border-slate-800 text-slate-900 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Assign mission
                        </button>
                        <button className="w-full py-2 px-3 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                          Full history
                        </button>
                      </div>
                    </div>
                  ) : null}
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
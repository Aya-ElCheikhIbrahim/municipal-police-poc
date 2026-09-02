import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import municipalPoliceLogo from './assets/policelogo.png';

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
type MissionPriority = 'Urgent' | 'High' | 'Low';
type MissionStatus = 'In progress' | 'Acknowledged' | 'New' | 'Completed' | 'Cancelled';
type UserRole = 'Officer' | 'Dispatcher' | 'Supervisor';
type UserStatus = 'Active' | 'Inactive';
type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';

interface SystemUser {
  id: string;
  name: string;
  badge: string;
  role: UserRole;
  phone: string;
  status: UserStatus;
}
interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  badge_number: string;
  role: 'officer' | 'sidpatcher' | 'supervisor';
  preferred_language: string;
}
interface Officer {
  id: string;
  name: string;
  badge: string;
  status: 'Available' | 'On mission' | 'Offline' | 'Panic';
  details: string;
  dutyTime: string;
  distanceCovered: string;
  coords: [number, number]; // [lat, lng]
}

interface LifecycleStep {
  label: string;
  time?: string;
  subtext?: string;
  status: 'completed' | 'active' | 'pending';
}

interface Mission {
  id: string;
  title: string;
  priority: MissionPriority;
  status: MissionStatus;
  assignedTo: string;
  badge: string;
  address: string;
  created: string;
  description?: string;
  officerNotes?: string;
  photos?: string[];
  lifecycle?: LifecycleStep[];
}

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

  // Navigation & Sub-view State
  const [activeTab, setActiveTab] = useState<TabType>('Missions');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('Daily activity');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [isCreatingMission, setIsCreatingMission] = useState<boolean>(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>('1');
  const [showMissionFilters, setShowMissionFilters] = useState(false);
  const [missionPriorityFilter, setMissionPriorityFilter] = useState('All');
  const [missionStatusFilter, setMissionStatusFilter] = useState('All');
  const [missionOfficerFilter, setMissionOfficerFilter] = useState('All');
  const [appliedPriorityFilter, setAppliedPriorityFilter] = useState('All');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('All');
  const [appliedOfficerFilter, setAppliedOfficerFilter] = useState('All');
  // Network & UI Demo States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [forceEmptyState, setForceEmptyState] = useState<boolean>(false);
  const [isConnectionLost, setIsConnectionLost] = useState<boolean>(false);
  const [secondsDisconnected, setSecondsDisconnected] = useState<number>(47);

  // Panic Simulation State
  const [isPanicActive, setIsPanicActive] = useState<boolean>(false);
  const [panicOfficer, setPanicOfficer] = useState<Officer | null>(null);

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

  // Users Tab State
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [activeUserFilter, setActiveUserFilter] = useState<'All' | 'ActiveOnly'>('All');

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserBadge, setNewUserBadge] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('+961 ');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Officer');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Users List Data
  const [usersList, setUsersList] = useState<SystemUser[]>([
    { id: '1', name: 'Karim Haddad', badge: '214', role: 'Officer', phone: '+961 70 111 222', status: 'Active' },
    { id: '2', name: 'Layla Mansour', badge: '187', role: 'Officer', phone: '+961 71 333 444', status: 'Active' },
    { id: '3', name: 'Rania Saab', badge: '102', role: 'Dispatcher', phone: '+961 76 555 666', status: 'Active' },
    { id: '4', name: 'Nabil Khoury', badge: '195', role: 'Officer', phone: '+961 78 777 888', status: 'Inactive' },
  ]);

  // New Mission Form State
  const [newMissionTitle, setNewMissionTitle] = useState('Illegal parking blocking access');
  const [newMissionDescription, setNewMissionDescription] = useState(
    'Vehicle parked across the entrance to the covered market. Owner not present.'
  );
  const [newMissionPriority, setNewMissionPriority] = useState<MissionPriority>('Urgent');
  const [newMissionAssignee, setNewMissionAssignee] = useState('Karim Haddad · Badge 214');
  const [newMissionAddress, setNewMissionAddress] = useState('Rue Tall, Tripoli');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const tripoliLocations = [
  'Abu Samra, Tripoli, Lebanon', 'Bahsas, Tripoli, Lebanon',
  'Al Tall, Tripoli, Lebanon', 'Al Qobbe, Tripoli, Lebanon',
  'Al Dam Wal Farez, Tripoli, Lebanon', 'Al Maarad, Tripoli, Lebanon',
  'Jabal Mohsen, Tripoli, Lebanon', 'Tabbaneh, Tripoli, Lebanon',
  'Zahrieh, Tripoli, Lebanon', 'Azmi Street, Tripoli, Lebanon',
  'Old City, Tripoli, Lebanon', 'Mina, Tripoli, Lebanon', 'Mitein Street, Tripoli, Lebanon',
  'Central, Tripoli, Lebanon', 'Corniche, Tripoli, Lebanon', 'Metran Street, Tripoli, Lebanon',
  'Boulevard, Tripoli, Lebanon', 'Haddadine, Tripoli, Lebanon', 'Al Nini, Tripoli, Lebanon',
];
  const locationAliases: Record<string, string[]> = {
  'Abu Samra, Tripoli, Lebanon': [
    'abu samra', 'abou samra', 'abi samra', 'abo samra'
  ],

  'Bahsas, Tripoli, Lebanon': [
    'bahsas', 'bahssas', 'bohssas', 'bohsas', 'al bahsas', 'el bahsas'
  ],

  'Al Tall, Tripoli, Lebanon': [
    'tall', 'tal', 'tell', 'tel', 'al tall', 'el tall', 'al tell', 'el tell'
  ],

  'Al Qobbe, Tripoli, Lebanon': [
    'qobbe', 'qobbeh', 'kobbe', 'kobbeh', 'qubbe', 'qubbeh',
    'qibbeh', 'ebbeh', 'ebeh', 'ebe', 'ebbe'
  ],

  'Al Dam Wal Farez, Tripoli, Lebanon': [
    'dam w farez', 'dam wal farez', 'dam wel farez', 'dam el farez',
    'dam farez', 'dam w farz', 'dam wel farz', 'damm w farez', 'dam w farz'
  ],

  'Al Maarad, Tripoli, Lebanon': [
    'maarad', 'maared', 'maarad', 'al maarad', 'el maarad',
    'al maared', 'el maared'
  ],

  'Jabal Mohsen, Tripoli, Lebanon': [
    'jabal mohsen', 'jabal mohsin', 'jabal muhsin', 'jabal mohssin'
  ],

  'Tabbaneh, Tripoli, Lebanon': [
    'tabbaneh', 'tebbaneh', 'tabbane', 'tebbane', 'bab el tabbaneh',
    'bab al tabbaneh', 'bab el tebbeneh', 'tebbene'
  ],

  'Zahrieh, Tripoli, Lebanon': [
    'zahrieh', 'zahriyeh', 'zahriyyeh', 'zahriye', 'zahrieh', 'zehriye'
  ],

  'Azmi Street, Tripoli, Lebanon': [
    'azmi', 'azmi street', 'azmi st', 'azmy', 'aazmi', 'aazmi street'
  ],

  'Old City, Tripoli, Lebanon': [
    'old city', 'old tripoli', 'tripoli old city', 'old souks',
    'old souk', 'souk'
  ],

  'Mina, Tripoli, Lebanon': [
    'mina', 'el mina', 'al mina', 'minaa', 'el minaa', 'al minaa'
  ],

  'Mitein Street, Tripoli, Lebanon': [
    'miten', 'mitein' , 'miten street'
  ]
};
  const searchTripoliLocations = (query: string) => {
  const search = query.trim().toLowerCase();

  if (!search) {
    setLocationSuggestions([]);
    return;
  }

  const matches = tripoliLocations.filter((location) => {
  const matchesName = location.toLowerCase().includes(search);

  const matchesAlias = locationAliases[location]?.some((alias) =>
    alias.includes(search)
  );

  return matchesName || matchesAlias;
});

  setLocationSuggestions(matches.slice(0, 8));
};
  const [newMissionDeadline, setNewMissionDeadline] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>([34.4367, 35.8497]);

  // Officers Data
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

  // Missions List State
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

  // Leaflet Map Refs
  const liveMapRef = useRef<HTMLDivElement | null>(null);
  const liveMapInstance = useRef<L.Map | null>(null);

  const pickerMapRef = useRef<HTMLDivElement | null>(null);
  const pickerMapInstance = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  // Trigger Panic Simulation
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

  // ---------------------------------------------------------------------------
  // LEAFLET MAP 1: LIVE MAP INSTANCE INITIALIZATION
  // ---------------------------------------------------------------------------
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

    return () => {
      clearTimeout(timer);
    };
  }, [activeTab, isConnectionLost, isAuthenticated]);

  // ---------------------------------------------------------------------------
  // LEAFLET MAP 1: MARKERS & PAN UPDATE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'Live map' || !liveMapInstance.current || isConnectionLost || !isAuthenticated) return;

    const map = liveMapInstance.current;

    // Remove old markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add updated officer markers
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

  // ---------------------------------------------------------------------------
  // LEAFLET MAP 2: NEW MISSION LOCATION PICKER
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isCreatingMission || !pickerMapRef.current || isConnectionLost || !isAuthenticated) {
      if (pickerMapInstance.current) {
        pickerMapInstance.current.remove();
        pickerMapInstance.current = null;
        pickerMarkerRef.current = null;
      }
      return;
    }

    if (!pickerMapInstance.current) {
      const map = L.map(pickerMapRef.current, {
        center: selectedCoords,
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const pinHtml = `
        <div class="w-6 h-6 bg-rose-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
          📍
        </div>
      `;
      const pinIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-pin-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker(selectedCoords, { icon: pinIcon }).addTo(map);
      pickerMarkerRef.current = marker;

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const newLat = parseFloat(lat.toFixed(4));
        const newLng = parseFloat(lng.toFixed(4));
        setSelectedCoords([newLat, newLng]);
      });

      pickerMapInstance.current = map;
    }
  }, [isCreatingMission, isConnectionLost, isAuthenticated]);

  // Update pin location on click without rebuilding map instance
  useEffect(() => {
    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.setLatLng(selectedCoords);
    }
  }, [selectedCoords]);

  // Submit Mission Creation
  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMissionTitle) return;

    const assignedName = newMissionAssignee.split(' · ')[0] || 'Unassigned';
    const assignedBadge = newMissionAssignee.split('Badge ')[1] || '—';

    const createdMission: Mission = {
      id: `mission_${Date.now()}`,
      title: newMissionTitle,
      priority: newMissionPriority,
      status: 'In progress',
      assignedTo: assignedName,
      badge: assignedBadge,
      address: newMissionAddress,
      created: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: newMissionDescription,
      officerNotes: 'Mission created and awaiting update.',
      photos: ['—', '—', '—', '—'],
      lifecycle: [
        { label: 'Created', time: 'Just now', subtext: 'Rania Saab', status: 'completed' },
        { label: 'Assigned', time: 'Just now', subtext: `to ${assignedName}`, status: 'completed' },
        { label: 'Acknowledged', subtext: 'Pending officer', status: 'active' },
        { label: 'Started', subtext: 'Pending arrival', status: 'pending' },
        { label: 'In progress', subtext: '0 photos captured', status: 'pending' },
        { label: 'Completed', subtext: 'Awaiting officer', status: 'pending' },
      ],
    };

    setMissions([createdMission, ...missions]);
    setIsCreatingMission(false);
    setSelectedMissionId(createdMission.id);
    setForceEmptyState(false);
  };

  // Cancel Mission Handler
  const handleCancelMission = (id: string) => {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMissions((prevMissions) =>
      prevMissions.map((mission) => {
        if (mission.id === id) {
          const updatedLifecycle: LifecycleStep[] = [
            ...(mission.lifecycle || []),
            {
              label: 'Cancelled',
              time: currentTime,
              subtext: `Cancelled by ${currentUser?.full_name || 'Dispatcher'}`,
              status: 'completed',
            },
          ];

          return {
            ...mission,
            status: 'Cancelled',
            lifecycle: updatedLifecycle,
          };
        }
        return mission;
      })
    );
  };

  // Submit User Creation
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName) return;

    const newUser: SystemUser = {
      id: `user_${Date.now()}`,
      name: newUserName,
      badge: newUserBadge || '—',
      role: newUserRole,
      phone: newUserPhone,
      status: 'Active',
    };

    setUsersList([...usersList, newUser]);
    setIsAddingUser(false);

    setNewUserName('');
    setNewUserBadge('');
    setNewUserPhone('+961 ');
    setNewUserRole('Officer');
    setNewUserUsername('');
    setNewUserPassword('');
  };

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

      // Officers are mobile-only (requirements §3)
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

  const selectedMission = missions.find((m) => m.id === selectedMissionId);
  const selectedOfficer = officers.find((o) => o.id === selectedOfficerId);

  const filteredUsers = usersList.filter((u) => {
    if (activeUserFilter === 'ActiveOnly') return u.status === 'Active';
    return true;
  });

const displayMissions = forceEmptyState
  ? []
  : missions.filter((mission) => {
      const matchesPriority =
        appliedPriorityFilter === 'All' ||
        mission.priority === appliedPriorityFilter;

      const matchesStatus =
        appliedStatusFilter === 'All' ||
        mission.status === appliedStatusFilter;

      const matchesOfficer =
        appliedOfficerFilter === 'All' ||
        mission.assignedTo === appliedOfficerFilter;

      return matchesPriority && matchesStatus && matchesOfficer;
    });

  // Aggregate stats across active severity filter for top cards
  const summaryAssigned = dailyOfficerData.reduce((acc, row) => acc + row.assigned[severityFilter], 0);
  const summaryCompleted = dailyOfficerData.reduce((acc, row) => acc + row.completed[severityFilter], 0);

  // ---------------------------------------------------------------------------
  // 1. LOGIN SCREEN VIEW
  // ---------------------------------------------------------------------------
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

        {/* Demo State Controls & User Info */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">DEMO STATES:</span>
            <button
              onClick={handleTogglePanic}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isPanicActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white'
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

      {/* PANIC EMERGENCY BANNER */}
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
            {activeTab === 'Users' && (
              <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
                {!isAddingUser ? (
                  <div className="space-y-4 max-w-6xl mx-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveUserFilter('All')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                            activeUserFilter === 'All'
                              ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
                              : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                          }`}
                        >
                          All roles
                        </button>
                        <button
                          onClick={() => setActiveUserFilter('ActiveOnly')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                            activeUserFilter === 'ActiveOnly'
                              ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
                              : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                          }`}
                        >
                          Active only
                        </button>
                      </div>

                      <button
                        onClick={() => setIsAddingUser(true)}
                        className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors shadow-xs cursor-pointer"
                      >
                        Add user
                      </button>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                            <th className="p-3.5">NAME</th>
                            <th className="p-3.5">BADGE</th>
                            <th className="p-3.5">ROLE</th>
                            <th className="p-3.5">PHONE</th>
                            <th className="p-3.5">STATUS</th>
                            <th className="p-3.5 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 font-semibold text-slate-900">{u.name}</td>
                              <td className="p-3.5 text-slate-600">{u.badge}</td>
                              <td className="p-3.5 text-slate-600">{u.role}</td>
                              <td className="p-3.5 text-slate-600 font-mono">{u.phone}</td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    u.status === 'Active'
                                      ? 'bg-emerald-100/70 text-emerald-700'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <button className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer">
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs p-8 max-w-2xl mx-auto mt-2">
                    <h2 className="text-base font-bold text-slate-900 mb-6">Add user</h2>

                    <form onSubmit={handleCreateUser} className="space-y-5">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full name</label>
                          <input
                            type="text"
                            placeholder="Enter full name"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Badge number</label>
                          <input
                            type="text"
                            placeholder="e.g. 214"
                            value={newUserBadge}
                            onChange={(e) => setNewUserBadge(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                          <input
                            type="text"
                            placeholder="+961"
                            value={newUserPhone}
                            onChange={(e) => setNewUserPhone(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] bg-white text-slate-600"
                          >
                            <option value="Officer">Officer</option>
                            <option value="Dispatcher">Dispatcher</option>
                            <option value="Supervisor">Supervisor</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
                          <input
                            type="text"
                            placeholder="Used to sign in"
                            value={newUserUsername}
                            onChange={(e) => setNewUserUsername(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary password</label>
                          <input
                            type="password"
                            placeholder="Set a starting password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-3">
                        <button
                          type="submit"
                          className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-5 py-2.5 rounded-md transition-colors shadow-xs cursor-pointer"
                        >
                          Create user
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

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

            {/* MISSION DETAIL VIEW */}
            {activeTab === 'Missions' && selectedMissionId && selectedMission ? (
              <div className="flex-1 bg-white flex w-full">
                <div className="flex-1 p-8 overflow-y-auto space-y-6">
                  <button
                    onClick={() => setSelectedMissionId(null)}
                    className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to all missions
                  </button>

                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{selectedMission.title}</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedMission.address} · {selectedMission.assignedTo}, badge {selectedMission.badge}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        selectedMission.priority === 'Urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {selectedMission.priority}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-3">Photo evidence · 3 of 5</div>
                    <div className="grid grid-cols-4 gap-4">
                      {selectedMission.photos?.map((timeLabel, idx) => (
                        <div
                          key={idx}
                          className="h-36 bg-slate-100/80 rounded-lg border border-slate-200/60 flex items-center justify-center text-slate-400 text-xs font-medium"
                        >
                          {timeLabel}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="text-xs font-semibold text-slate-600">Officer notes</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedMission.officerNotes || 'No notes provided.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                      Reassign
                    </button>
                    <button
                      onClick={() => handleCancelMission(selectedMission.id)}
                      disabled={selectedMission.status === 'Cancelled'}
                      className={`text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
                        selectedMission.status === 'Cancelled'
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-[#C62828] hover:bg-rose-800 text-white'
                      }`}
                    >
                      {selectedMission.status === 'Cancelled' ? 'Mission cancelled' : 'Cancel mission'}
                    </button>
                  </div>
                </div>

                <aside className="w-72 bg-slate-50/60 border-l border-slate-200 p-6 flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-500 mb-6 uppercase tracking-wider">Lifecycle</h3>

                  <div className="relative pl-6 space-y-6 flex-1">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

                    {selectedMission.lifecycle?.map((step, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        <div
                          className={`absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            step.status === 'completed'
                              ? 'bg-[#2E7D32]'
                              : step.status === 'active'
                              ? 'bg-[#1F3864]'
                              : 'bg-slate-300'
                          }`}
                        ></div>

                        <div className="text-xs">
                          <div className="font-bold text-slate-900 leading-tight">{step.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {step.time && <span className="font-medium text-slate-600">{step.time} · </span>}
                            <span>{step.subtext}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            ) : null}

            {/* CREATE MISSION VIEW WITH LEAFLET PIN PICKER MAP */}
            {activeTab === 'Missions' && isCreatingMission && !selectedMissionId && (
              <div className="flex-1 bg-white flex w-full">
                <div className="w-1/2 p-8 overflow-y-auto space-y-6">
                  <h2 className="text-lg font-bold text-slate-900">New mission</h2>

                  <form onSubmit={handleCreateMission} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={newMissionTitle}
                        onChange={(e) => setNewMissionTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={newMissionDescription}
                        onChange={(e) => setNewMissionDescription(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                        <select
                          value={newMissionPriority}
                          onChange={(e) => setNewMissionPriority(e.target.value as MissionPriority)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] bg-white"
                        >
                          <option value="Urgent">Urgent</option>
                          <option value="High">High</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Assign to</label>
                        <select
                          value={newMissionAssignee}
                          onChange={(e) => setNewMissionAssignee(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] bg-white"
                        >
                          {officers.map((off) => (
                            <option key={off.id} value={`${off.name} · ${off.badge}`}>
                              {off.name} · {off.badge}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                        <input
                          type="text"
                          value={newMissionAddress}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNewMissionAddress(value);
                            searchTripoliLocations(value);
                           }}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                        />
{locationSuggestions.length > 0 && (
  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
    {locationSuggestions.map((location, index) => (
      <button
        key={index}
        type="button"
        onClick={() => {
          setNewMissionAddress(location);
          setLocationSuggestions([]);
        }}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
      >
        {location}
      </button>
    ))}
  </div>

)}

                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Deadline - optional</label>
                        <input
                          type="text"
                          placeholder="Select date and time"
                          value={newMissionDeadline}
                          onChange={(e) => setNewMissionDeadline(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                      <button
                        type="submit"
                        className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-5 py-2 rounded-md transition-colors cursor-pointer"
                      >
                        Create and assign
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingMission(false)}
                        className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>

                {/* Leaflet Pin Picker Container */}
                <div className="w-1/2 p-4 relative flex flex-col bg-slate-100">
                  <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                    <div ref={pickerMapRef} className="w-full h-full z-0" />

                    <div className="absolute top-4 left-4 right-4 z-10 pointer-events-none">
                      <div className="bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow-md text-xs text-slate-700 border border-slate-200">
                        Click anywhere on the map to set the mission location pin.
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur px-3 py-1 rounded text-[11px] text-slate-700 font-mono shadow-xs border border-slate-200">
                      {selectedCoords[0]}, {selectedCoords[1]}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MISSIONS TABLE VIEW */}
            {activeTab === 'Missions' && !isCreatingMission && !selectedMissionId && (
              <div className="flex-1 bg-white p-6 overflow-y-auto flex flex-col">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LOADING</div>
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                            <th className="p-3">TITLE</th>
                            <th className="p-3">PRIORITY</th>
                            <th className="p-3">STATUS</th>
                            <th className="p-3">ASSIGNED TO</th>
                            <th className="p-3">CREATED</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[1, 2, 3].map((item) => (
                            <tr key={item} className="animate-pulse">
                              <td className="p-3">
                                <div className="h-2.5 bg-slate-200 rounded-full w-3/4"></div>
                                <div className="h-2.5 bg-slate-200 rounded-full w-1/2 mt-1.5"></div>
                              </td>
                              <td className="p-3">
                                <div className="h-2.5 bg-slate-200 rounded-full w-12"></div>
                              </td>
                              <td className="p-3">
                                <div className="h-2.5 bg-slate-200 rounded-full w-16"></div>
                              </td>
                              <td className="p-3">
                                <div className="h-2.5 bg-slate-200 rounded-full w-44"></div>
                                <div className="h-2.5 bg-slate-200 rounded-full w-28 mt-1.5"></div>
                              </td>
                              <td className="p-3">
                                <div className="h-2.5 bg-slate-200 rounded-full w-12"></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : displayMissions.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center py-16 px-4 relative">
                    <div className="absolute top-0 left-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      EMPTY
                    </div>

                    <div className="text-center max-w-md mx-auto">
                      <h3 className="text-sm font-bold text-slate-900 mb-1">No missions match these filters</h3>
                      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                        Try widening the date range or clearing the officer filter.
                      </p>

                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
  setForceEmptyState(false);
  setMissionPriorityFilter('All');
  setMissionStatusFilter('All');
  setMissionOfficerFilter('All');
  setAppliedPriorityFilter('All');
  setAppliedStatusFilter('All');
  setAppliedOfficerFilter('All');
}}
                          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
                        >
                          Clear filters
                        </button>
                        <button
                          onClick={() => {
                            setForceEmptyState(false);
                            setIsCreatingMission(true);
                          }}
                          className="px-4 py-2 bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
                        >
                          New mission
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="relative flex items-center gap-2">
                        <button className="px-3 py-1 bg-[#1F3864] text-white text-xs font-medium rounded cursor-pointer">
                          All statuses
                        </button>
                        <button className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium rounded cursor-pointer">
                          Today
                        </button>
                        <button
                          onClick={() => setShowMissionFilters(!showMissionFilters)}
                          className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium rounded cursor-pointer"
                        >
                          Filter
                        </button>
                        {showMissionFilters && (
                         <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-64 z-50">
<div className="space-y-3">
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">
      Priority
    </label>
    <select
  value={missionPriorityFilter}
  onChange={(e) => setMissionPriorityFilter(e.target.value)}
  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
>
  <option value="All">All</option>
  <option value="Urgent">Urgent</option>
  <option value="High">High</option>
  <option value="Low">Low</option>
</select>
  </div>

  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">
      Status
    </label>
    <select
  value={missionStatusFilter}
  onChange={(e) => setMissionStatusFilter(e.target.value)}
  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
>
  <option value="All">All</option>
  <option value="New">New</option>
  <option value="Acknowledged">Acknowledged</option>
  <option value="In progress">In progress</option>
  <option value="Completed">Completed</option>
  <option value="Cancelled">Cancelled</option>
</select>
  </div>

  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">
      Officer
    </label>
    <select
  value={missionOfficerFilter}
  onChange={(e) => setMissionOfficerFilter(e.target.value)}
  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
>
  <option value="All">All</option>
  <option value="Karim Haddad">Karim Haddad</option>
  <option value="Layla Mansour">Layla Mansour</option>
  <option value="Samir Youssef">Samir Youssef</option>
  <option value="Nabil Khoury">Nabil Khoury</option>
</select>
  </div>
  

  <div className="flex justify-end gap-2 pt-2">
  <button
    onClick={() => {
      setMissionPriorityFilter('All');
      setMissionStatusFilter('All');
      setMissionOfficerFilter('All');
    }}
    className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
  >
    Clear
  </button>

  <button
    onClick={() => {
  setAppliedPriorityFilter(missionPriorityFilter);
  setAppliedStatusFilter(missionStatusFilter);
  setAppliedOfficerFilter(missionOfficerFilter);
  setShowMissionFilters(false);
}}
    className="px-3 py-1 text-xs bg-[#1F3864] text-white rounded hover:bg-[#182c50]"
  >
    Apply
  </button>
</div>
</div>
                         </div>
                      )}
                      </div>
                      <button
                        onClick={() => setIsCreatingMission(true)}
                        className="bg-[#1F3864] text-white text-xs font-semibold px-4 py-1.5 rounded shadow-xs hover:bg-[#182c50] transition-colors cursor-pointer"
                      >
                        New mission
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                            <th className="p-3">Title</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Assigned To</th>
                            <th className="p-3">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayMissions.map((m) => (
                            <tr
                              key={m.id}
                              onClick={() => setSelectedMissionId(m.id)}
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <td className="p-3 font-semibold text-slate-900">{m.title}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.priority === 'Urgent'
                                      ? 'bg-rose-100 text-rose-700'
                                      : m.priority === 'High'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {m.priority}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    m.status === 'Cancelled'
                                      ? 'bg-rose-100 text-rose-700 font-bold'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700">{m.assignedTo}</td>
                              <td className="p-3 text-slate-400">{m.created}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* LIVE MAP TAB WITH REAL INTERACTIVE LEAFLET MAP */}
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

                {/* Leaflet Map Div */}
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

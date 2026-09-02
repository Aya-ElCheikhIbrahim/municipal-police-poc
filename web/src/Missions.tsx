import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {
  Mission,
  MissionPriority,
  Officer,
  LifecycleStep,
  AuthUser,
} from './types';
import { tripoliLocations, locationAliases } from './constants';

interface MissionsProps {
  missions: Mission[];
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
  selectedMissionId: string | null;
  setSelectedMissionId: React.Dispatch<React.SetStateAction<string | null>>;
  isCreatingMission: boolean;
  setIsCreatingMission: React.Dispatch<React.SetStateAction<boolean>>;
  officers: Officer[];
  currentUser: AuthUser | null;
  isLoading: boolean;
  forceEmptyState: boolean;
  setForceEmptyState: React.Dispatch<React.SetStateAction<boolean>>;
  isConnectionLost: boolean;
  isAuthenticated: boolean;
}

export default function Missions({
  missions,
  setMissions,
  selectedMissionId,
  setSelectedMissionId,
  isCreatingMission,
  setIsCreatingMission,
  officers,
  currentUser,
  isLoading,
  forceEmptyState,
  setForceEmptyState,
  isConnectionLost,
  isAuthenticated,
}: MissionsProps) {
  // Filter States
  const [showMissionFilters, setShowMissionFilters] = useState(false);
  const [missionPriorityFilter, setMissionPriorityFilter] = useState('All');
  const [missionStatusFilter, setMissionStatusFilter] = useState('All');
  const [missionOfficerFilter, setMissionOfficerFilter] = useState('All');
  const [appliedPriorityFilter, setAppliedPriorityFilter] = useState('All');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('All');
  const [appliedOfficerFilter, setAppliedOfficerFilter] = useState('All');

  // New Mission Form State
  const [newMissionTitle, setNewMissionTitle] = useState('Illegal parking blocking access');
  const [newMissionDescription, setNewMissionDescription] = useState(
    'Vehicle parked across the entrance to the covered market. Owner not present.'
  );
  const [newMissionPriority, setNewMissionPriority] = useState<MissionPriority>('Urgent');
  const [newMissionAssignee, setNewMissionAssignee] = useState('Karim Haddad · Badge 214');
  const [newMissionAddress, setNewMissionAddress] = useState('Rue Tall, Tripoli');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [newMissionDeadline, setNewMissionDeadline] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>([34.4367, 35.8497]);

  // Leaflet Location Picker Refs
  const pickerMapRef = useRef<HTMLDivElement | null>(null);
  const pickerMapInstance = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

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

  // LEAFLET MAP: LOCATION PICKER FOR NEW MISSION
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

  useEffect(() => {
    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.setLatLng(selectedCoords);
    }
  }, [selectedCoords]);

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

  const selectedMission = missions.find((m) => m.id === selectedMissionId);

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

  // 1. MISSION DETAIL VIEW
  if (selectedMissionId && selectedMission) {
    return (
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
    );
  }

  // 2. CREATE MISSION VIEW
  if (isCreatingMission) {
    return (
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
    );
  }

  // 3. MAIN MISSIONS TABLE VIEW
  return (
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Officer</label>
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
  );
}
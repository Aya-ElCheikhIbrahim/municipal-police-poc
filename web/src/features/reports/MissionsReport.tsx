import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePanicAlerts } from '../panic/usePanicAlerts';
import { useMissions } from '../missions/useMissions';
import { statusLabel, priorityLabel, formatTime, type MissionListItem } from '../missions/types';
import { fetchDailySummary } from './api';

type StatusFilter = 'ALL' | MissionListItem['status'];
type PriorityFilter = 'ALL' | MissionListItem['priority'];
type SortField = 'title' | 'officer' | 'status' | 'priority' | 'location' | 'assigned' | 'created';

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const officerNames = (mission: MissionListItem) =>
  mission.assigned_to.map((officer) => officer.full_name).join(', ') || 'Unassigned';

const locationOf = (mission: MissionListItem) => mission.address?.trim() || '—';

const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

interface MissionsReportProps {
  onMissionSelect: (missionId: number) => void;
}

export function MissionsReport({ onMissionSelect }: MissionsReportProps) {
  const today = todayLocal();

  // Real missions from the backend (GET /missions/?date=today), polled live.
  const { missions, isLoading, error, refresh } = useMissions({ date: today });

  // Officer status cards come from the daily summary + panic feed (real telemetry).
  const { alerts: panics } = usePanicAlerts();
  const [liveOfficers, setLiveOfficers] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  const loadOfficers = () => {
    fetchDailySummary({ date: today })
      .then((data) => data?.officers && setLiveOfficers(data.officers))
      .catch(console.error);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  useEffect(() => {
    loadOfficers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [priority, setPriority] = useState<PriorityFilter>('ALL');
  const [officer, setOfficer] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortAsc, setSortAsc] = useState(false);

  const officerOptions = useMemo(
    () => Array.from(new Set(missions.flatMap((m) => m.assigned_to.map((o) => o.full_name)))).sort(),
    [missions],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(missions.map(locationOf).filter((value) => value !== '—'))).sort(),
    [missions],
  );

  const rows = useMemo(() => {
    const filtered = missions.filter((mission) => {
      if (status !== 'ALL' && mission.status !== status) return false;
      if (priority !== 'ALL' && mission.priority !== priority) return false;
      if (officer !== 'ALL' && !mission.assigned_to.some((o) => o.full_name === officer)) return false;
      if (location !== 'ALL' && locationOf(mission) !== location) return false;
      return true;
    });

    const valueOf = (mission: MissionListItem): string | number => {
      switch (sortField) {
        case 'title': return mission.title.toLowerCase();
        case 'officer': return officerNames(mission).toLowerCase();
        case 'status': return mission.status;
        case 'priority': return PRIORITY_RANK[mission.priority] ?? 0;
        case 'location': return locationOf(mission).toLowerCase();
        case 'assigned': return mission.assigned_at ?? '';
        case 'created': return mission.created_at;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const diff =
        typeof av === 'number'
          ? av - (bv as number)
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortAsc ? diff : -diff;
    });
  }, [missions, status, priority, officer, location, sortField, sortAsc]);

  const inProgress = missions.filter((m) => m.status === 'in_progress').length;
  const completed = missions.filter((m) => m.status === 'completed').length;
  const cancelled = missions.filter((m) => m.status === 'cancelled').length;
  const urgent = missions.filter((m) => m.priority === 'urgent').length;

  const panicNames = new Set(panics.map((panic) => panic.officer.full_name));
  const officerCardNames = Array.from(
    new Set([...liveOfficers.map((o) => o.officer_name), ...panics.map((p) => p.officer.full_name)]),
  ).sort();

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortAsc((current) => !current);
      return;
    }
    setSortField(field);
    setSortAsc(field === 'title' || field === 'officer' || field === 'status' || field === 'location');
  };

  const handleRefresh = () => {
    refresh();
    loadOfficers();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mission Overview</h2>
          <p className="mt-1 text-sm text-slate-500">Today's live missions from the backend for {today}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Last updated: {lastUpdated}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            ↻ Refresh
          </button>
          <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live / Current
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Today's missions" value={missions.length} />
        <SummaryCard label="In progress" value={inProgress} />
        <SummaryCard label="Completed" value={completed} />
        <SummaryCard label="Cancelled" value={cancelled} />
        <SummaryCard label="Urgent" value={urgent} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800">Current Officer Status</h3>
            <p className="mt-0.5 text-xs text-slate-500">Directly reflecting backend officer telemetry.</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Available</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />On Mission</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Panic</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
          {officerCardNames.map((name) => {
            const backendOfficer = liveOfficers.find((o) => o.officer_name === name);
            const isPanic = panicNames.has(name) || (backendOfficer?.panic_events ?? 0) > 0;
            const isOnMission = (backendOfficer?.missions_in_progress ?? 0) > 0;
            const statusLabelText = isPanic ? 'Panic' : isOnMission ? 'On Mission' : 'Available';

            return (
              <div
                key={name}
                className={`rounded-lg border px-4 py-3 ${isPanic ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50/70'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-800">
                    {name} {backendOfficer?.badge_number ? `(${backendOfficer.badge_number})` : ''}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isPanic ? 'bg-rose-600 text-white animate-pulse' : isOnMission ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isPanic ? 'bg-white' : isOnMission ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                    {statusLabelText}
                  </span>
                </div>
              </div>
            );
          })}
          {officerCardNames.length === 0 && (
            <div className="col-span-full py-4 text-center text-slate-400 text-sm">No officers on duty today.</div>
          )}
        </div>
      </div>

      <div className="bg-white/90 rounded-lg border border-slate-200/80 shadow-xs">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Filter Missions</span>
          <button
            type="button"
            onClick={() => {
              setStatus('ALL');
              setPriority('ALL');
              setOfficer('ALL');
              setLocation('ALL');
            }}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium cursor-pointer underline"
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
          <Filter label="Status" value={status} onChange={(value) => setStatus(value as StatusFilter)}>
            <option value="ALL">All Statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Filter>

          <Filter label="Priority" value={priority} onChange={(value) => setPriority(value as PriorityFilter)}>
            <option value="ALL">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Filter>

          <Filter label="Assigned Officer" value={officer} onChange={setOfficer}>
            <option value="ALL">All Officers</option>
            {officerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </Filter>

          <Filter label="Area / Location" value={location} onChange={setLocation}>
            <option value="ALL">All Areas</option>
            {locationOptions.map((area) => <option key={area} value={area}>{area}</option>)}
          </Filter>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-800">Mission Activity</h3>
          <span className="text-sm font-semibold text-slate-500">
            {rows.length} mission{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[1020px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <SortHeader label="Mission" field="title" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Assigned Officer" field="officer" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Status" field="status" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Priority" field="priority" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Area / Location" field="location" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Assigned" field="assigned" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Created" field="created" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((mission) => (
                <tr key={mission.id} className={rowPriorityClass(mission.priority)}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onMissionSelect(mission.id)}
                      className="font-bold text-[#203E72] hover:text-[#162d55] hover:underline cursor-pointer text-left"
                      title="Open mission details"
                    >
                      {mission.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#203E72]">{officerNames(mission)}</td>
                  <td className="px-4 py-3"><StatusBadge status={mission.status} /></td>
                  <td className="px-4 py-3 font-semibold">{priorityLabel(mission.priority)}</td>
                  <td className="px-4 py-3">{locationOf(mission)}</td>
                  <td className="px-4 py-3 font-medium">{mission.assigned_at ? formatTime(mission.assigned_at) : '—'}</td>
                  <td className="px-4 py-3">{formatTime(mission.created_at)}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    {isLoading ? 'Loading missions from backend...' : 'No missions match the selected filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  field,
  currentField,
  asc,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  asc: boolean;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        <span className="text-[11px] leading-none text-slate-400">
          {currentField === field ? (asc ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 text-base text-slate-700 outline-none focus:ring-1 focus:ring-slate-400"
      >
        {children}
      </select>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/80 p-4 rounded-lg border border-slate-200/80 shadow-xs">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: MissionListItem['status'] }) {
  const style =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-rose-100 text-rose-700'
        : status === 'in_progress'
          ? 'bg-sky-100 text-sky-700'
          : 'bg-slate-100 text-slate-700';

  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${style}`}>{statusLabel(status)}</span>;
}

function rowPriorityClass(priority: string) {
  if (priority === 'urgent') return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500 transition-colors';
  if (priority === 'high') return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500 transition-colors';
  return 'bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-500 transition-colors';
}

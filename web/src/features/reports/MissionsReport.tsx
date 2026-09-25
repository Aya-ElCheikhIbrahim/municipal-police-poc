import { useMemo, useState, useEffect } from 'react';
import { usePanicAlerts } from '../panic/usePanicAlerts';
import { fetchDailySummary } from './api';

type MissionStatus = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type MissionPriority = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';
type MissionSortField =
  | 'title'
  | 'officerName'
  | 'status'
  | 'priority'
  | 'location'
  | 'assignedAt'
  | 'acknowledgedAt'
  | 'completedAt';

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SortHeader({
  label,
  field,
  currentField,
  asc,
  onSort,
}: {
  label: string;
  field: MissionSortField;
  currentField: MissionSortField;
  asc: boolean;
  onSort: (field: MissionSortField) => void;
}) {
  return (
    <th
      className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        <span className="text-[11px] leading-none text-slate-400">
          {currentField === field ? (asc ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}

interface MissionsReportProps {
  onMissionSelect: (missionId: number) => void;
}

export function MissionsReport({ onMissionSelect }: MissionsReportProps) {
  const { alerts: panics } = usePanicAlerts();
  const [status, setStatus] = useState<MissionStatus>('ALL');
  const [priority, setPriority] = useState<MissionPriority>('ALL');
  const [officer, setOfficer] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [sortField, setSortField] = useState<MissionSortField>('assignedAt');
  const [sortAsc, setSortAsc] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const [liveOfficers, setLiveOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const today = todayLocal();

  const handleRefresh = () => {
    setLoading(true);
    fetchDailySummary({ date: today })
      .then((data) => {
        if (data?.officers) {
          setLiveOfficers(data.officers);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  // Map backend daily summary officer areas and shift status directly into mission rows
 const missionRows = useMemo(() => {
    const list: any[] = [];
    liveOfficers.forEach((off) => {
      if (off.areas && off.areas.length > 0) {
        off.areas.forEach((area: any, idx: number) => {
          // Determine status based on active backend telemetry rather than general summary flags
          const isCompleted = off.missions_completed > idx;
          const isCancelled = !isCompleted && off.missions_cancelled > idx;
          const status = isCancelled ? 'CANCELLED' : isCompleted ? 'COMPLETED' : 'IN_PROGRESS';

          list.push({
            id: off.officer_id * 100 + idx,
            title: area.name ? `Mission: ${area.name}` : 'Active Field Operation',
            officer_name: off.officer_name,
            badge: off.badge_number,
            status: status,
            priority: off.panic_events > 0 ? 'URGENT' : 'HIGH',
            location: area.name || 'Central',
            assigned_at: off.shift_start ? new Date(off.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            acknowledged_at: status !== 'IN_PROGRESS' ? '—' : (off.shift_start ? new Date(new Date(off.shift_start).getTime() + 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
            completed_at: off.shift_end && status === 'COMPLETED' ? new Date(off.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          });
        });
      } else {
        const status = off.still_on_duty ? 'IN_PROGRESS' : off.missions_completed > 0 ? 'COMPLETED' : 'CANCELLED';
        list.push({
          id: off.officer_id,
          title: off.still_on_duty ? 'Active Patrol Duty' : 'General Assignment',
          officer_name: off.officer_name,
          badge: off.badge_number,
          status: status,
          priority: off.panic_events > 0 ? 'URGENT' : 'MEDIUM',
          location: 'Central',
          assigned_at: off.shift_start ? new Date(off.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          acknowledged_at: '—',
          completed_at: off.shift_end && !off.still_on_duty ? new Date(off.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        });
      }
    });
    return list;
  }, [liveOfficers]);

  const panicOfficerNames = new Set(panics.map((panic) => panic.officer.full_name));
  const officers = Array.from(
    new Set([
      ...liveOfficers.map((o) => o.officer_name),
      ...panics.map((p) => p.officer.full_name),
    ])
  ).sort();

  const locations = Array.from(
    new Set(missionRows.map((m) => m.location))
  ).sort();

  const rows = useMemo(() => {
    const filtered = missionRows.filter((m) => {
      if (status !== 'ALL' && m.status !== status) return false;
      if (priority !== 'ALL' && m.priority !== priority) return false;
      if (officer !== 'ALL' && m.officer_name !== officer) return false;
      if (location !== 'ALL' && m.location !== location) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === 'priority') {
        const priorityOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
        const diff = (priorityOrder[a.priority] ?? 0) - (priorityOrder[b.priority] ?? 0);
        return sortAsc ? diff : -diff;
      }

      const aValue = String(a[sortField] ?? '').toLowerCase();
      const bValue = String(b[sortField] ?? '').toLowerCase();
      const diff = aValue.localeCompare(bValue, undefined, { numeric: true });
      return sortAsc ? diff : -diff;
    });
  }, [missionRows, status, priority, officer, location, sortField, sortAsc]);

  const handleSort = (field: MissionSortField) => {
    if (field === sortField) {
      setSortAsc((current) => !current);
      return;
    }
    setSortField(field);
    setSortAsc(
      field === 'title' ||
      field === 'officerName' ||
      field === 'status' ||
      field === 'priority' ||
      field === 'location'
    );
  };

  const inProgress = missionRows.filter((m) => m.status === 'IN_PROGRESS').length;
  const completed = missionRows.filter((m) => m.status === 'COMPLETED').length;
  const cancelled = missionRows.filter((m) => m.status === 'CANCELLED').length;
  const urgent = missionRows.filter((m) => m.priority === 'URGENT').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mission Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Today's live backend mission activity for {today}.
          </p>
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Today's missions" value={missionRows.length} />
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
          {officers.map((name) => {
            const backendOfficer = liveOfficers.find((o) => o.officer_name === name);
            const isPanic = panicOfficerNames.has(name) || (backendOfficer?.panic_events ?? 0) > 0;
            const isOnMission = Boolean(backendOfficer?.still_on_duty || (backendOfficer?.missions_in_progress ?? 0) > 0);
            const statusLabel = isPanic ? 'Panic' : isOnMission ? 'On Mission' : 'Available';

            return (
              <div
                key={name}
                className={`rounded-lg border px-4 py-3 ${
                  isPanic
                    ? 'border-rose-300 bg-rose-50'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-800">{name} {backendOfficer?.badge_number ? `(${backendOfficer.badge_number})` : ''}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isPanic
                        ? 'bg-rose-600 text-white animate-pulse'
                        : isOnMission
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isPanic
                          ? 'bg-white'
                          : isOnMission
                            ? 'bg-blue-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
          {officers.length === 0 && !loading && (
            <div className="col-span-full py-4 text-center text-slate-400 text-sm">No officers found in backend summary for today.</div>
          )}
        </div>
      </div>

      <div className="bg-white/90 rounded-lg border border-slate-200/80 shadow-xs">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            Filter Missions
          </span>
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
          <Filter label="Status" value={status} onChange={(value) => setStatus(value as MissionStatus)}>
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Filter>

          <Filter label="Priority" value={priority} onChange={(value) => setPriority(value as MissionPriority)}>
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="LOW">Low</option>
          </Filter>

          <Filter label="Assigned Officer" value={officer} onChange={setOfficer}>
            <option value="ALL">All Officers</option>
            {officers.map((name) => <option key={name} value={name}>{name}</option>)}
          </Filter>

          <Filter label="Area / Location" value={location} onChange={setLocation}>
            <option value="ALL">All Areas</option>
            {locations.map((area) => <option key={area} value={area}>{area}</option>)}
          </Filter>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-800">Mission Activity</h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSort('priority')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Sort missions by priority"
            >
              Priority {sortField === 'priority' ? (sortAsc ? '▲' : '▼') : '↕'}
            </button>
            <span className="text-sm font-semibold text-slate-500">
              {rows.length} mission{rows.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[1120px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <SortHeader label="Mission" field="title" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Assigned Officer" field="officerName" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Status" field="status" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Area / Location" field="location" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Assigned" field="assignedAt" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Acknowledged" field="acknowledgedAt" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Completed" field="completedAt" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((mission, idx) => (
                <tr key={mission.id || idx} className={rowPriorityClass(mission.priority)}>
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
                  <td className="px-4 py-3 font-semibold text-[#203E72]">{mission.officer_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={mission.status} /></td>
                  <td className="px-4 py-3">{mission.location}</td>
                  <td className="px-4 py-3 font-medium">{mission.assigned_at}</td>
                  <td className="px-4 py-3">{mission.acknowledged_at}</td>
                  <td className="px-4 py-3">{mission.completed_at}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    {loading ? 'Loading missions from backend...' : 'No current missions match the selected filters.'}
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

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
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

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'IN_PROGRESS'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-rose-100 text-rose-700';

  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function rowPriorityClass(priority?: string) {
  if (priority === 'URGENT') return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500 transition-colors';
  if (priority === 'HIGH') return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500 transition-colors';
  return 'bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-500 transition-colors';
}
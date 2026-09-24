import { useMemo, useState } from 'react';
import { officerMissionData } from './mockData';
import { usePanicAlerts } from '../panic/usePanicAlerts';

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

  const handleRefresh = () => {
    // When connected to the backend, re-fetch current missions/officer status here.
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const today = todayLocal();

  // Current/live report: use today's mission records for now.
  // When the backend live missions endpoint is connected, this data source can be replaced
  // without changing the report UI.
  const todayMissions = officerMissionData.filter((mission) => mission.date === today);

  const panicOfficerNames = new Set(panics.map((panic) => panic.officer.full_name));
  const officers = Array.from(
    new Set([
      ...todayMissions.map((mission) => mission.officerName),
      ...panics.map((panic) => panic.officer.full_name),
    ])
  ).sort();

  const assignedOfficersFor = (mission: (typeof officerMissionData)[number]) =>
    Array.from(
      new Set(
        officerMissionData
          .filter(
            (item) =>
              item.id === mission.id
          )
          .map((item) => item.officerName)
      )
    );
  const locations = Array.from(new Set(todayMissions.map((mission) => mission.location))).sort();

  const rows = useMemo(() => {
    const filtered = todayMissions.filter((mission) => {
      if (status !== 'ALL' && mission.status !== status) return false;
      if (priority !== 'ALL' && mission.priority !== priority) return false;
      if (officer !== 'ALL' && !assignedOfficersFor(mission).includes(officer)) return false;
      if (location !== 'ALL' && mission.location !== location) return false;
      return true;
    });

    const unique = filtered.filter(
      (mission, index, all) =>
        all.findIndex(
          (item) =>
            item.id === mission.id
        ) === index
    );

    return [...unique].sort((a, b) => {
      if (sortField === 'priority') {
        const priorityOrder: Record<string, number> = {
          LOW: 1,
          MEDIUM: 2,
          HIGH: 3,
          URGENT: 4,
        };

        const diff =
          (priorityOrder[a.priority] ?? 0) -
          (priorityOrder[b.priority] ?? 0);

        return sortAsc ? diff : -diff;
      }

      const aValue = String(a[sortField] ?? '').toLowerCase();
      const bValue = String(b[sortField] ?? '').toLowerCase();
      const diff = aValue.localeCompare(bValue, undefined, { numeric: true });
      return sortAsc ? diff : -diff;
    });
  }, [todayMissions, status, priority, officer, location, sortField, sortAsc]);

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

  const uniqueTodayMissions = todayMissions.filter(
    (mission, index, all) =>
      all.findIndex((item) => item.id === mission.id) === index
  );

  const inProgress = uniqueTodayMissions.filter((mission) => mission.status === 'IN_PROGRESS').length;
  const completed = uniqueTodayMissions.filter((mission) => mission.status === 'COMPLETED').length;
  const cancelled = uniqueTodayMissions.filter((mission) => mission.status === 'CANCELLED').length;
  const urgent = uniqueTodayMissions.filter((mission) => mission.priority === 'URGENT').length;


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mission Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Today's mission activity and officer status for {today}.
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
        <SummaryCard label="Today's missions" value={uniqueTodayMissions.length} />
        <SummaryCard label="In progress" value={inProgress} />
        <SummaryCard label="Completed" value={completed} />
        <SummaryCard label="Cancelled" value={cancelled} />
        <SummaryCard label="Urgent" value={urgent} />
      </div>


      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800">Current Officer Status</h3>
            <p className="mt-0.5 text-xs text-slate-500">Quick view of officer availability based on today's current mission activity.</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Available</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />On Mission</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Panic</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
          {officers.map((name) => {
            const activeMission = todayMissions.find(
              (mission) =>
                mission.status === 'IN_PROGRESS' &&
                assignedOfficersFor(mission).includes(name)
            );
            const isPanic = panicOfficerNames.has(name);
            const isOnMission = Boolean(activeMission);
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
                  <span className="font-bold text-slate-800">{name}</span>
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
                {activeMission && (
                  <div className="mt-2 text-xs text-slate-500 truncate" title={activeMission.title}>
                    {activeMission.title}
                  </div>
                )}
              </div>
            );
          })}
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
                  <td className="px-4 py-3 font-semibold text-[#203E72]"><CompactAssignedOfficers names={assignedOfficersFor(mission)} /></td>
                  <td className="px-4 py-3"><StatusBadge status={mission.status} /></td>
                  <td className="px-4 py-3">{mission.location}</td>
                  <td className="px-4 py-3 font-medium">{mission.assignedAt}</td>
                  <td className="px-4 py-3">{mission.acknowledgedAt}</td>
                  <td className="px-4 py-3">{mission.completedAt}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No current missions match the selected filters.
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


function CompactAssignedOfficers({ names }: { names: string[] }) {
  const [showAll, setShowAll] = useState(false);

  if (names.length === 0) return <span>—</span>;
  if (names.length === 1) return <span>{names[0]}</span>;
  if (names.length === 2) return <span>{names[0]}, {names[1]}</span>;

  if (showAll) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>{names.join(', ')}</span>
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          Show less
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{names[0]}, {names[1]}</span>
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-[#203E72] hover:bg-slate-200 cursor-pointer"
        aria-label={`Show ${names.length - 2} more assigned officer${names.length - 2 === 1 ? '' : 's'}`}
      >
        +{names.length - 2}
      </button>
    </span>
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

function rowPriorityClass(priority: string) {
  if (priority === 'URGENT') return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500 transition-colors';
  if (priority === 'HIGH') return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500 transition-colors';
  return 'bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-500 transition-colors';
}

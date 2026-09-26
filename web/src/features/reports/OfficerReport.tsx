import { useEffect, useMemo, useState } from 'react';
import { MissionDetailPage } from '../missions/MissionDetailPage';
import { useActiveOfficers } from '../officers/useOfficers';
import { displayOfficerStatus } from '../officers/types';
import { usePanicAlerts } from '../panic/usePanicAlerts';
import { exportDailyCSV, exportDailyPDF, fetchOfficerReport } from './api';
import type {
  FilterState,
  OfficerMission,
  OfficerReportResponse,
  ReportSubTab,
} from './types.ts';

interface OfficerReportProps {
  officerId: number;
  sourceTab: ReportSubTab;
  filters: FilterState;
  onBack: () => void;
  onMissionSelect?: (missionId: number) => void;
}

type PeriodMode = 'DAY' | 'WEEK' | 'CUSTOM';
type MissionSortField = 'date' | 'title' | 'status' | 'priority' | 'location' | 'assignedAt' | 'acknowledgedAt' | 'completedAt';

function formatDate(date: string) {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateDaysBefore(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - days);
  return localDateString(date);
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatTime(isoString: string | null) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

export function OfficerReport({ officerId, sourceTab, filters, onBack, onMissionSelect }: OfficerReportProps) {
  const today = localDateString(new Date());

  const initialMode: PeriodMode = sourceTab === 'Daily activity' ? 'DAY' : sourceTab === 'Weekly summary' ? 'WEEK' : 'CUSTOM';
  const [periodMode, setPeriodMode] = useState<PeriodMode>(initialMode);
  const [dayDate, setDayDate] = useState(sourceTab === 'Daily activity' ? filters.startDate : filters.endDate || today);
  const [weekEnd, setWeekEnd] = useState(filters.endDate || today);
  const [customStart, setCustomStart] = useState(filters.startDate);
  const [customEnd, setCustomEnd] = useState(filters.endDate);
  const [missionStatus, setMissionStatus] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'>('ALL');
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [missionSortField, setMissionSortField] = useState<MissionSortField>('date');
  const [missionSortAsc, setMissionSortAsc] = useState(false);

  const { officers } = useActiveOfficers(false);
  const { alerts: panics } = usePanicAlerts(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<OfficerReportResponse | null>(null);

  const periodStart = periodMode === 'DAY'
    ? dayDate
    : periodMode === 'WEEK'
    ? dateDaysBefore(weekEnd, 6)
    : customStart;

  const periodEnd = periodMode === 'DAY'
    ? dayDate
    : periodMode === 'WEEK'
    ? weekEnd
    : customEnd;

  useEffect(() => {
    setLoading(true);
    fetchOfficerReport({
      officer_id: officerId,
      start_date: periodStart,
      end_date: periodEnd,
      status: missionStatus !== 'ALL' ? missionStatus : undefined,
    })
      .then((data) => setReportData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [officerId, periodStart, periodEnd, missionStatus]);

  const missions = reportData?.missions || [];

  const sortedMissions = useMemo(() => {
    const priorityRank: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...missions].sort((a, b) => {
      if (missionSortField === 'priority') {
        const result = (priorityRank[a.priority] ?? 0) - (priorityRank[b.priority] ?? 0);
        return missionSortAsc ? result : -result;
      }
      const left = String(a[missionSortField as keyof OfficerMission] ?? '').toLowerCase();
      const right = String(b[missionSortField as keyof OfficerMission] ?? '').toLowerCase();
      const result = left.localeCompare(right, undefined, { numeric: true });
      return missionSortAsc ? result : -result;
    });
  }, [missions, missionSortField, missionSortAsc]);

  const handleMissionSort = (field: MissionSortField) => {
    if (missionSortField === field) setMissionSortAsc((current) => !current);
    else {
      setMissionSortField(field);
      setMissionSortAsc(field === 'title' || field === 'status');
    }
  };

  const selectedRangeText = periodStart === periodEnd
    ? formatDate(periodStart)
    : `${formatDate(periodStart)} — ${formatDate(periodEnd)}`;

  const handleExport = (format: 'CSV' | 'PDF') => {
    if (format === 'CSV') {
      exportDailyCSV(periodStart, officerId, missionStatus);
    } else {
      exportDailyPDF(periodStart, officerId, missionStatus);
    }
  };

  if (selectedMissionId !== null) {
    return (
      <MissionDetailPage
        missionId={selectedMissionId}
        officers={officers}
        onBack={() => setSelectedMissionId(null)}
        onChanged={() => {}}
      />
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-semibold">Loading officer report...</div>;
  }

  const summary = reportData?.summary;
  const performance = reportData?.performance;
  const officerInfo = reportData?.officer;
  const timeline = reportData?.timeline || [];

  const completedCount = summary?.missions_completed ?? 0;
  const cancelledCount = summary?.missions_cancelled ?? 0;
  const inProgressCount = summary?.missions_in_progress ?? 0;

  // Live status comes from the active-officers feed (+ panic feed), matched by id.
  // Officers not on an active shift are not in the feed, so they read as Off Duty.
  const activeEntry = officers.find((o) => o.officer.id === officerId);
  const feedStatus = activeEntry ? displayOfficerStatus(activeEntry) : null;
  const hasActivePanic = panics.some((p) => p.officer.id === officerId);
  const currentStatus =
    hasActivePanic || feedStatus === 'panic'
      ? 'Panic'
      : feedStatus === 'on_mission'
      ? 'On Mission'
      : feedStatus === 'available'
      ? 'Available'
      : 'Off Duty';

  const officerStatusStyle =
    currentStatus === 'Panic'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : currentStatus === 'On Mission'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : currentStatus === 'Available'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const officerStatusDot =
    currentStatus === 'Panic'
      ? 'bg-rose-500'
      : currentStatus === 'On Mission'
      ? 'bg-blue-500'
      : currentStatus === 'Available'
      ? 'bg-emerald-500'
      : 'bg-slate-400';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-sm font-semibold text-[#203E72] hover:underline cursor-pointer">
          ← Back to Reports
        </button>

        <div className="flex gap-2">
          <button onClick={() => handleExport('CSV')} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer">
            Export CSV
          </button>
          <button onClick={() => handleExport('PDF')} className="inline-flex h-10 items-center justify-center rounded-md bg-[#203E72] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#19345f] cursor-pointer">
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1 bg-[#203E72]" />
        <div className="p-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">Officer Details</div>
            <h2 className="text-xl font-extrabold !text-[#203E72]">{officerInfo?.name || `Officer #${officerId}`}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Badge {officerInfo?.badge_number || '—'}
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-semibold ${officerStatusStyle}`}>
                <span className={`h-2 w-2 rounded-full ${officerStatusDot}`} />
                {currentStatus}
              </span>
            </div>
          </div>

          <div className="space-y-2 min-w-[300px]">
            <div className="flex flex-wrap gap-1 justify-start sm:justify-end">
              {(['DAY', 'WEEK', 'CUSTOM'] as PeriodMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-base font-semibold cursor-pointer ${periodMode === mode ? 'bg-[#1F3864] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {mode === 'DAY' ? 'Day' : mode === 'WEEK' ? 'This Week' : 'Custom Range'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
              {periodMode === 'DAY' && (
                <CalendarDateInput value={dayDate} max={today} onChange={setDayDate} className="max-w-[170px]" />
              )}
              {periodMode === 'WEEK' && (
                <CalendarDateInput value={weekEnd} max={today} onChange={setWeekEnd} className="max-w-[170px]" />
              )}
              {periodMode === 'CUSTOM' && (
                <>
                  <CalendarDateInput value={customStart} max={customEnd || today} onChange={setCustomStart} className="max-w-[170px]" />
                  <CalendarDateInput value={customEnd} min={customStart} max={today} onChange={setCustomEnd} className="max-w-[170px]" />
                </>
              )}
            </div>
            <div className="text-base font-semibold text-slate-500 text-left sm:text-right">{selectedRangeText}</div>
          </div>
        </div>
      </div>

      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <MetricCard value={formatMinutes((summary?.hours_on_duty ?? 0) * 60)} label="Hours on duty" />
          <MetricCard value={`${((summary?.distance_covered_m ?? 0) / 1000).toFixed(1)} km`} label="Distance covered" />
          <MetricCard value={summary?.missions_assigned ?? 0} label="Missions" />
          <MetricCard value={completedCount} label="Completed" />
          <MetricCard value={cancelledCount} label="Cancelled" />
          <MetricCard value={inProgressCount} label="In progress" />
          <MetricCard value={summary?.panic_events ?? 0} label="Panic events" />
        </div>
      </section>

      {periodMode === 'DAY' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">Activity Timeline</h3>
            <span className="text-base font-semibold text-slate-500">{timeline.length} event{timeline.length === 1 ? '' : 's'}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-4 py-3">Area / Location</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.map((event, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-800">{formatTime(event.at)}</td>
                    <td className="px-4 py-3 text-slate-600">{event.area || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-md text-sm font-bold bg-slate-100 text-slate-700">
                        {event.activity_label || event.activity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{event.details}</td>
                  </tr>
                ))}
                {timeline.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">No activity found for this day.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Mission Outcomes</h3>
          <div className="grid grid-cols-3 gap-3">
            <OutcomeCard value={completedCount} label="Completed" />
            <OutcomeCard value={inProgressCount} label="In progress" />
            <OutcomeCard value={cancelledCount} label="Cancelled" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Performance</h3>
          <div className="grid grid-cols-2 gap-3">
            <ResponseCard
              value={performance?.average_acknowledgement_seconds ? `${Math.round(performance.average_acknowledgement_seconds / 60)}m` : '—'}
              label="Avg acknowledgement"
            />
            <ResponseCard
              value={performance?.average_completion_seconds ? `${Math.round(performance.average_completion_seconds / 60)}m` : '—'}
              label="Avg completion"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">Mission History</h3>
            <div className="flex items-center gap-1">
              {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'CANCELLED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMissionStatus(status)}
                  className={`px-2 py-1 rounded text-sm font-semibold cursor-pointer ${missionStatus === status ? 'bg-[#1F3864] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleMissionSort('priority')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Sort missions by priority"
            >
              Priority {missionSortField === 'priority' ? (missionSortAsc ? '▲' : '▼') : '↕'}
            </button>
            <span className="text-base font-semibold text-slate-500">{sortedMissions.length} mission{sortedMissions.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <SortHeader label="Date" field="date" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
                <SortHeader label="Mission" field="title" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
                <SortHeader label="Status" field="status" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
                <th className="px-4 py-3">Area / Location</th>
                <SortHeader label="Assigned" field="assignedAt" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
                <SortHeader label="Acknowledged" field="acknowledgedAt" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
                <SortHeader label="Completed" field="completedAt" currentField={missionSortField} asc={missionSortAsc} onSort={handleMissionSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedMissions.map((mission) => (
                <MissionRow
                  key={mission.mission_id}
                  mission={mission}
                  onSelect={() => {
                    if (onMissionSelect) onMissionSelect(mission.mission_id);
                    else setSelectedMissionId(mission.mission_id);
                  }}
                />
              ))}
              {sortedMissions.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No missions match this period and status.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalendarDateInput({
  value,
  min,
  max,
  onChange,
  className = '',
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="YYYY-MM-DD"
        onChange={(e) => onChange(e.target.value)}
        className="filter-control pr-10"
        aria-label="Date"
      />
      <input
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0"
        aria-label="Open calendar"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    </div>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4">
      <div className="text-base font-bold text-slate-900">{value}</div>
      <div className="text-base text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}

function OutcomeCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 rounded-lg p-3">
      <div className="text-base font-bold text-slate-900">{value}</div>
      <div className="text-sm font-semibold text-slate-500 uppercase mt-1">{label}</div>
    </div>
  );
}

function ResponseCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 rounded-lg p-4">
      <div className="text-base font-bold text-slate-900">{value}</div>
      <div className="text-base text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function MissionRow({ mission, onSelect }: { mission: OfficerMission; onSelect: () => void }) {
  const priorityRowStyle =
    mission.priority === 'URGENT'
      ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500'
      : mission.priority === 'HIGH'
      ? 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500'
      : 'bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-500';

  const statusStyle =
    mission.status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800'
      : mission.status === 'IN_PROGRESS'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-800';

  return (
    <tr className={`transition-colors ${priorityRowStyle}`}>
      <td className="px-4 py-3 text-slate-600">{formatDate(mission.assigned_at ? mission.assigned_at.slice(0, 10) : '')}</td>
      <td className="px-4 py-3 font-semibold text-slate-900">
        <button
          type="button"
          onClick={onSelect}
          className="text-left font-semibold text-[#203E72] hover:underline cursor-pointer"
        >
          {mission.title}
        </button>
      </td>
      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-sm font-bold ${statusStyle}`}>{mission.status.replace('_', ' ')}</span></td>
      <td className="px-4 py-3 text-slate-600">{mission.area || '—'}</td>
      <td className="px-4 py-3 text-slate-600">{formatTime(mission.assigned_at)}</td>
      <td className="px-4 py-3 text-slate-600">{formatTime(mission.acknowledged_at)}</td>
      <td className="px-4 py-3 text-slate-600">{formatTime(mission.completed_at)}</td>
    </tr>
  );
}
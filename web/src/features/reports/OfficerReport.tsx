import { useMemo, useState } from 'react';
import {
  officerActivityData,
  officerMissionData,
  officerPeriodData,
  officerProfiles,
  type FilterState,
  type OfficerMissionRecord,
  type ReportSubTab,
} from './mockData';

interface OfficerReportProps {
  officerName: string;
  sourceTab: ReportSubTab;
  filters: FilterState;
  onBack: () => void;
}

type PeriodMode = 'DAY' | 'WEEK' | 'CUSTOM';

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
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function differenceMinutes(start: string, end: string) {
  if (!start || !end || end === '—') return null;
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

export function OfficerReport({ officerName, sourceTab, filters, onBack }: OfficerReportProps) {
  const profile = officerProfiles[officerName];
  const today = localDateString(new Date());

  const initialMode: PeriodMode = sourceTab === 'Daily activity' ? 'DAY' : sourceTab === 'Weekly summary' ? 'WEEK' : 'CUSTOM';
  const [periodMode, setPeriodMode] = useState<PeriodMode>(initialMode);
  const [dayDate, setDayDate] = useState(sourceTab === 'Daily activity' ? filters.startDate : filters.endDate || today);
  const [weekEnd, setWeekEnd] = useState(filters.endDate || today);
  const [customStart, setCustomStart] = useState(filters.startDate);
  const [customEnd, setCustomEnd] = useState(filters.endDate);
  const [missionStatus, setMissionStatus] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'>('ALL');

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

  const missions = useMemo(() => {
    return officerMissionData.filter((mission) => {
      if (mission.officerName !== officerName) return false;
      if (mission.date < periodStart || mission.date > periodEnd) return false;
      if (missionStatus !== 'ALL' && mission.status !== missionStatus) return false;
      if (filters.location !== 'ALL' && mission.location !== filters.location) return false;
      return true;
    });
  }, [officerName, periodStart, periodEnd, filters.location, missionStatus]);

  const timeline = useMemo(() => {
    if (periodMode !== 'DAY') return [];

    const matchingMissionIds = new Set(missions.map((mission) => mission.id));

    return officerActivityData.filter((event) => {
      if (event.officerName !== officerName || event.date !== periodStart) return false;
      if (filters.location !== 'ALL' && event.location !== filters.location) return false;
      if (missionStatus !== 'ALL') {
        return event.missionId !== undefined && matchingMissionIds.has(event.missionId);
      }
      return true;
    });
  }, [officerName, periodStart, filters.location, periodMode, missions, missionStatus]);

  const periodRecords = officerPeriodData.filter((row) =>
    row.officerName === officerName && row.date >= periodStart && row.date <= periodEnd
  );

  const totalDutyMinutes = periodRecords.reduce((sum, row) => sum + row.dutyMinutes, 0);
  const totalDistance = periodRecords.reduce((sum, row) => sum + row.distanceKm, 0);
  const panicEvents = periodRecords.reduce((sum, row) => sum + row.panicEvents, 0);

  const completedCount = missions.filter((mission) => mission.status === 'COMPLETED').length;
  const cancelledCount = missions.filter((mission) => mission.status === 'CANCELLED').length;
  const inProgressCount = missions.filter((mission) => mission.status === 'IN_PROGRESS').length;

  const acknowledgementTimes = missions
    .map((mission) => differenceMinutes(mission.assignedAt, mission.acknowledgedAt))
    .filter((value): value is number => value !== null);

  const completionTimes = missions
    .filter((mission) => mission.status === 'COMPLETED')
    .map((mission) => differenceMinutes(mission.assignedAt, mission.completedAt))
    .filter((value): value is number => value !== null);

  const avgAcknowledgement = acknowledgementTimes.length
    ? Math.round(acknowledgementTimes.reduce((sum, value) => sum + value, 0) / acknowledgementTimes.length)
    : null;

  const avgCompletion = completionTimes.length
    ? Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length)
    : null;

  const selectedRangeText = periodStart === periodEnd
    ? formatDate(periodStart)
    : `${formatDate(periodStart)} — ${formatDate(periodEnd)}`;

  const handleExport = (format: 'CSV' | 'PDF') => {
    alert(`Exporting ${officerName}'s filtered activity as ${format}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-sm font-semibold text-[#203E72] hover:underline cursor-pointer">
          ← Back to Reports
        </button>

        <div className="flex gap-2">
          <button onClick={() => handleExport('CSV')} className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-md text-xs font-semibold text-slate-700 shadow-xs cursor-pointer">
            Export CSV
          </button>
          <button onClick={() => handleExport('PDF')} className="bg-[#203E72] hover:bg-[#19345f] px-4 py-2 rounded-md text-xs font-semibold text-white shadow-xs cursor-pointer">
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1 bg-[#203E72]" />
        <div className="p-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Officer Details</div>
            <h2 className="text-xl font-bold text-slate-900">{officerName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Badge {profile?.badge ?? '—'}
            </p>
          </div>

          <div className="space-y-2 min-w-[300px]">
            <div className="flex flex-wrap gap-1 justify-start sm:justify-end">
              {(['DAY', 'WEEK', 'CUSTOM'] as PeriodMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer ${periodMode === mode ? 'bg-[#1F3864] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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
            <div className="text-xs font-semibold text-slate-500 text-left sm:text-right">{selectedRangeText}</div>
          </div>
        </div>
      </div>

      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <MetricCard value={formatMinutes(totalDutyMinutes)} label="Hours on duty" />
          <MetricCard value={`${totalDistance.toFixed(1)} km`} label="Distance covered" />
          <MetricCard value={missions.length} label="Missions" />
          <MetricCard value={completedCount} label="Completed" />
          <MetricCard value={cancelledCount} label="Cancelled" />
          <MetricCard value={inProgressCount} label="In progress" />
          <MetricCard value={panicEvents} label="Panic events" />
        </div>
      </section>

      {periodMode === 'DAY' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Activity Timeline</h3>
            <span className="text-xs font-semibold text-slate-500">{timeline.length} event{timeline.length === 1 ? '' : 's'}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-4 py-3">Area / Location</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-bold text-slate-800">{event.time}</td>
                    <td className="px-4 py-3.5 text-slate-600">{event.location}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold ${
                        event.activity.includes('completed') ? 'bg-emerald-50 text-emerald-700' :
                        event.activity.includes('cancelled') ? 'bg-rose-50 text-rose-700' :
                        event.activity === 'Available' ? 'bg-sky-50 text-sky-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {event.activity}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{event.details}</td>
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
          <h3 className="text-sm font-bold text-slate-900 mb-4">Mission Outcomes</h3>
          <div className="grid grid-cols-3 gap-3">
            <OutcomeCard value={completedCount} label="Completed" />
            <OutcomeCard value={inProgressCount} label="In progress" />
            <OutcomeCard value={cancelledCount} label="Cancelled" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Performance</h3>
          <div className="grid grid-cols-2 gap-3">
            <ResponseCard value={avgAcknowledgement !== null ? `${avgAcknowledgement}m` : '—'} label="Avg acknowledgement" />
            <ResponseCard value={avgCompletion !== null ? `${avgCompletion}m` : '—'} label="Avg completion" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900">Mission History</h3>
            <div className="flex items-center gap-1">
              {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'CANCELLED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMissionStatus(status)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${missionStatus === status ? 'bg-[#1F3864] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{missions.length} mission{missions.length === 1 ? '' : 's'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-4 py-3">Mission</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Area / Location</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Acknowledged</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {missions.map((mission) => <MissionRow key={mission.id} mission={mission} />)}
              {missions.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No missions match this period and status.</td></tr>
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
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}

function OutcomeCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 rounded-lg p-3">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase mt-1">{label}</div>
    </div>
  );
}

function ResponseCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 rounded-lg p-4">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function MissionRow({ mission }: { mission: OfficerMissionRecord }) {
  const priorityStyle =
    mission.priority === 'URGENT'
      ? 'bg-rose-100 text-rose-800'
      : mission.priority === 'HIGH'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-700';

  const statusStyle =
    mission.status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800'
      : mission.status === 'IN_PROGRESS'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-800';

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="px-5 py-3.5 text-slate-600">{formatDate(mission.date)}</td>
      <td className="px-4 py-3.5 font-semibold text-slate-900">{mission.title}</td>
      <td className="px-4 py-3.5"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${priorityStyle}`}>{mission.priority}</span></td>
      <td className="px-4 py-3.5"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${statusStyle}`}>{mission.status.replace('_', ' ')}</span></td>
      <td className="px-4 py-3.5 text-slate-600">{mission.location}</td>
      <td className="px-4 py-3.5 text-slate-600">{mission.assignedAt}</td>
      <td className="px-4 py-3.5 text-slate-600">{mission.acknowledgedAt}</td>
      <td className="px-4 py-3.5 text-slate-600">{mission.completedAt}</td>
    </tr>
  );
}
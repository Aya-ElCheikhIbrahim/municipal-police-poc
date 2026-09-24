import { useEffect, useState } from 'react';
import { MissionDetailPage } from '../missions/MissionDetailPage';
import { useActiveOfficers } from '../officers/useOfficers';
import { exportDailyCSV, exportDailyPDF, fetchOfficerReport } from './api';
import type {
  FilterState,
  OfficerReportResponse,
  ReportSubTab,
} from './types';

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
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatTime(isoString: string | null) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function OfficerReport({ officerName, sourceTab, filters, onBack }: OfficerReportProps) {
  const today = localDateString(new Date());

  const initialMode: PeriodMode = sourceTab === 'Daily activity' ? 'DAY' : sourceTab === 'Weekly summary' ? 'WEEK' : 'CUSTOM';
  const [periodMode, setPeriodMode] = useState<PeriodMode>(initialMode);
  const [dayDate, setDayDate] = useState(sourceTab === 'Daily activity' ? filters.startDate : filters.endDate || today);
  const [weekEnd, setWeekEnd] = useState(filters.endDate || today);
  const [customStart, setCustomStart] = useState(filters.startDate);
  const [customEnd, setCustomEnd] = useState(filters.endDate);
  const [missionStatus, setMissionStatus] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED'>('ALL');
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const { officers } = useActiveOfficers(false);

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

  // Safely find officer ID matching name or ID string
  const activeOfficer = officers.find((o: any) => o.name === officerName || String(o.id || o.user_id) === officerName);
  const officerId = (activeOfficer as any)?.id || (activeOfficer as any)?.user_id || Number.parseInt(officerName, 10) || 1;

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
  const missions = reportData?.missions || [];
  const timeline = reportData?.timeline || [];

  const completedCount = summary?.missions_completed ?? 0;
  const cancelledCount = summary?.missions_cancelled ?? 0;
  const inProgressCount = summary?.missions_in_progress ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-sm font-semibold text-[#203E72] hover:underline cursor-pointer">
          ← Back to Reports
        </button>

        <div className="flex gap-2">
          <button onClick={() => handleExport('CSV')} className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-md text-base font-semibold text-slate-700 shadow-xs cursor-pointer">
            Export CSV
          </button>
          <button onClick={() => handleExport('PDF')} className="bg-[#203E72] hover:bg-[#19345f] px-4 py-2 rounded-md text-base font-semibold text-white shadow-xs cursor-pointer">
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1 bg-[#203E72]" />
        <div className="p-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">Officer Details</div>
            <h2 className="text-base font-bold text-slate-900">{officerInfo?.name || officerName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Badge {officerInfo?.badge_number || '—'}
            </p>
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
                <tr className="bg-slate-50 text-xs lg:text-sm uppercase tracking-wider font-semibold text-slate-500">
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
          <span className="text-base font-semibold text-slate-500">{missions.length} mission{missions.length === 1 ? '' : 's'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-xs lg:text-sm uppercase tracking-wider font-semibold text-slate-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-4 py-3">Mission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Area / Location</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Acknowledged</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {missions.map((mission) => (
                <MissionRow
                  key={mission.mission_id}
                  mission={mission}
                  onSelect={() => setSelectedMissionId(mission.mission_id)}
                />
              ))}
              {missions.length === 0 && (
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

function MissionRow({ mission, onSelect }: { mission: any; onSelect: () => void }) {
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
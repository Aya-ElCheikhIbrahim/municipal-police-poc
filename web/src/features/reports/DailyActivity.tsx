import { useEffect, useMemo, useState } from 'react';
import { fetchDailySummary, fetchActivityFeed } from './api';
import type {
  ActivityRow,
  DailySummaryResponse,
  FilterState,
} from './types';

export type DailyViewMode = 'SUMMARY' | 'SNAPSHOT';

interface DailyActivityProps {
  filters?: FilterState;
  mode?: DailyViewMode;
  onOfficerSelect?: (officerName: string) => void;
}

type DailySortField = 'hours' | 'distance' | 'assigned' | 'completed' | 'cancelled' | 'panic';

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function SortHeader({
  label,
  field,
  currentField,
  asc,
  onSort,
}: {
  label: string;
  field: DailySortField;
  currentField: DailySortField;
  asc: boolean;
  onSort: (field: DailySortField) => void;
}) {
  return (
    <th
      className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100"
      onClick={() => onSort(field)}
    >
      {label} <span className="text-xs text-slate-400">{currentField === field ? (asc ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}

export function DailyActivity({ filters, mode = 'SUMMARY', onOfficerSelect }: DailyActivityProps) {
  const selectedDate = filters?.startDate || new Date().toISOString().slice(0, 10);
  const [sortField, setSortField] = useState<DailySortField>('hours');
  const [sortAsc, setSortAsc] = useState(false);

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<DailySummaryResponse | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);

  useEffect(() => {
    setLoading(true);
    if (mode === 'SUMMARY') {
      fetchDailySummary({
        date: selectedDate,
        status: filters?.status !== 'ALL' ? filters?.status : undefined,
      })
        .then((data) => setSummaryData(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      fetchActivityFeed({
        date: selectedDate,
        from_time: filters?.fromTime || undefined,
        to_time: filters?.toTime || undefined,
      })
        .then((data) => setActivityRows(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedDate, mode, filters?.status, filters?.fromTime, filters?.toTime]);

  const dailyRows = useMemo(() => {
    if (!summaryData?.officers) return [];
    return summaryData.officers.map((officer) => ({
      id: officer.officer_id,
      name: officer.officer_name,
      shiftStart: officer.shift_start
        ? new Date(officer.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—',
      shiftEnd: officer.still_on_duty
        ? 'On Duty'
        : officer.shift_end
        ? new Date(officer.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—',
      dutyHours: formatMinutes(Math.round(officer.hours_on_duty * 60)),
      dutyMinutes: Math.round(officer.hours_on_duty * 60),
      distance: `${(officer.distance_covered_m / 1000).toFixed(1)} km`,
      assigned: officer.missions_assigned,
      completed: officer.missions_completed,
      cancelled: officer.missions_cancelled,
      panic: officer.panic_events,
    }));
  }, [summaryData]);

  const sortedDailyRows = useMemo(() => {
    return [...dailyRows].sort((a, b) => {
      let diff = 0;
      if (sortField === 'hours') diff = a.dutyMinutes - b.dutyMinutes;
      else if (sortField === 'assigned') diff = a.assigned - b.assigned;
      else if (sortField === 'completed') diff = a.completed - b.completed;
      else if (sortField === 'cancelled') diff = a.cancelled - b.cancelled;
      else if (sortField === 'panic') diff = a.panic - b.panic;
      return sortAsc ? diff : -diff;
    });
  }, [dailyRows, sortField, sortAsc]);

  const handleSort = (field: DailySortField) => {
    if (field === sortField) setSortAsc((prev) => !prev);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-semibold">Loading report data...</div>;
  }

  if (mode === 'SNAPSHOT') {
    return (
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-800">Activity Lookup</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activityRows.map((event, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOfficerSelect?.(event.officer?.name || 'System')}
                      className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left"
                    >
                      {event.officer?.name || 'System'}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{event.area || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 rounded-md text-sm font-bold bg-slate-100 text-slate-700">
                      {event.activity_label || event.activity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{event.details}</td>
                </tr>
              ))}
              {activityRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No activity matches the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
          Click an officer’s name to view details.
        </div>
      </div>
    );
  }

  const totals = summaryData?.totals;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <SummaryCard value={totals?.officers_on_duty ?? 0} label="Officers on duty" />
        <SummaryCard value={formatMinutes(Math.round((totals?.hours_on_duty ?? 0) * 60))} label="Duty hours" />
        <SummaryCard value={`${((totals?.distance_covered_m ?? 0) / 1000).toFixed(1)} km`} label="Distance" />
        <SummaryCard value={totals?.missions_assigned ?? 0} label="Assigned" />
        <SummaryCard value={totals?.missions_completed ?? 0} label="Completed" />
        <SummaryCard value={totals?.missions_cancelled ?? 0} label="Cancelled" />
        <SummaryCard value={totals?.panic_events ?? 0} label="Panic events" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Officer Daily Activity</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[930px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Duty Period</th>
                <SortHeader label="Hours" field="hours" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Distance" field="distance" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Assigned" field="assigned" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Completed" field="completed" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Cancelled" field="cancelled" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Panic" field="panic" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sortedDailyRows.map((row) => (
                <tr key={row.id || row.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOfficerSelect?.(row.name)}
                      className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    {row.shiftStart} → {row.shiftEnd}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{row.dutyHours}</td>
                  <td className="px-4 py-3 text-slate-700">{row.distance}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.assigned}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                      {row.completed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${
                        row.cancelled > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {row.cancelled}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.panic}</td>
                </tr>
              ))}

              {sortedDailyRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    No officer activity found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
          Click an officer’s name to view details.
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
      <div className="text-base font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}
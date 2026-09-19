import { useMemo, useState } from 'react';
import {
  dailyOfficerData,
  officerActivityData,
  officerMissionData,
  officerPeriodData,
  officerProfiles,
  type FilterState,
} from './mockData';

export type DailyViewMode = 'SUMMARY' | 'SNAPSHOT';

interface DailyActivityProps {
  filters?: FilterState;
  mode?: DailyViewMode;
  onOfficerSelect?: (officerName: string) => void;
}

type DailySortField = 'hours' | 'distance' | 'assigned' | 'completed' | 'cancelled' | 'panic';

function distanceToNumber(value: string) {
  return Number.parseFloat(value) || 0;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function addMinutes(start: string, minutesToAdd: number) {
  const [hours, minutes] = start.split(':').map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function defaultShiftStart(shift: string) {
  if (shift === 'AFTERNOON') return '13:00';
  if (shift === 'NIGHT') return '20:00';
  return '08:00';
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
      {label} <span className="text-[9px] text-slate-400">{currentField === field ? (asc ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}

export function DailyActivity({ filters, mode = 'SUMMARY', onOfficerSelect }: DailyActivityProps) {
  const selectedDate = filters?.startDate || new Date().toISOString().slice(0, 10);
  const officerFilter = filters?.officer ?? 'ALL';
  const locationFilter = filters?.location ?? 'ALL';
  const fromTime = filters?.fromTime ?? '';
  const toTime = filters?.toTime ?? '';

  const [sortField, setSortField] = useState<DailySortField>('hours');
  const [sortAsc, setSortAsc] = useState(false);

  const dailyRows = officerPeriodData
    .filter((period) => period.date === selectedDate)
    .filter((period) => officerFilter === 'ALL' || period.officerName === officerFilter)
    .map((period) => {
      const allDayMissions = officerMissionData.filter(
        (mission) => mission.officerName === period.officerName && mission.date === selectedDate
      );
      const missions = allDayMissions.filter(
        (mission) => locationFilter === 'ALL' || mission.location === locationFilter
      );

      // An area filter means "show officers with a mission in this area on this day".
      // This prevents the same unfiltered daily totals from appearing under unrelated areas.
      if (locationFilter !== 'ALL' && missions.length === 0) return null;

      const todayRow = dailyOfficerData.find(
        (row) => row.name === period.officerName && row.date === selectedDate
      );
      const profile = officerProfiles[period.officerName];
      const shiftStart = todayRow?.shiftStart ?? defaultShiftStart(profile?.shift ?? 'MORNING');
      const shiftEnd = todayRow?.shiftEnd ?? addMinutes(shiftStart, period.dutyMinutes);

      return {
        name: period.officerName,
        date: selectedDate,
        shiftStart,
        shiftEnd,
        dutyHours: formatMinutes(period.dutyMinutes),
        distance: `${period.distanceKm.toFixed(1)} km`,
        assigned: missions.length,
        completed: missions.filter((mission) => mission.status === 'COMPLETED').length,
        cancelled: missions.filter((mission) => mission.status === 'CANCELLED').length,
        panic: period.panicEvents,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const sortedDailyRows = useMemo(() => {
    const getValue = (row: (typeof dailyRows)[number]) => {
      switch (sortField) {
        case 'hours': {
          const period = officerPeriodData.find((item) => item.officerName === row.name && item.date === row.date);
          return period?.dutyMinutes ?? 0;
        }
        case 'distance': return distanceToNumber(row.distance);
        case 'assigned': return row.assigned;
        case 'completed': return row.completed;
        case 'cancelled': return row.cancelled;
        case 'panic': return row.panic;
      }
    };

    return [...dailyRows].sort((a, b) => {
      const diff = getValue(a) - getValue(b);
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

  if (mode === 'SNAPSHOT') {
    const activityRows = officerActivityData
      .filter((event) => {
        if (event.date !== selectedDate) return false;
        if (officerFilter !== 'ALL' && event.officerName !== officerFilter) return false;
        if (locationFilter !== 'ALL' && event.location !== locationFilter) return false;
        if (fromTime && event.time < fromTime) return false;
        if (toTime && event.time > toTime) return false;
        return true;
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    let heading = 'Activity Lookup';
    if (fromTime && toTime) heading = `Activity from ${fromTime} to ${toTime}`;
    else if (fromTime) heading = `Activity from ${fromTime}`;
    else if (toTime) heading = `Activity until ${toTime}`;

    return (
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">{heading}</h3>
          {locationFilter !== 'ALL' && <span className="text-xs font-semibold text-slate-500">{locationFilter}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activityRows.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => onOfficerSelect?.(event.officerName)} className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left">
                      {event.officerName}
                    </button>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-800">{event.time}</td>
                  <td className="px-4 py-4 text-slate-700">{event.location}</td>
                  <td className="px-4 py-4 font-medium text-slate-800">{event.activity}</td>
                  <td className="px-4 py-4 text-slate-600">{event.details}</td>
                </tr>
              ))}
              {activityRows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No activity matches the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500">Click an officer’s name to view details.</div>
      </div>
    );
  }

  const totalAssigned = dailyRows.reduce((sum, row) => sum + row.assigned, 0);
  const totalCompleted = dailyRows.reduce((sum, row) => sum + row.completed, 0);
  const totalCancelled = dailyRows.reduce((sum, row) => sum + row.cancelled, 0);
  const totalDutyMinutes = dailyRows.reduce((sum, row) => {
    const period = officerPeriodData.find((item) => item.officerName === row.name && item.date === row.date);
    return sum + (period?.dutyMinutes ?? 0);
  }, 0);
  const totalDistance = dailyRows.reduce((sum, row) => sum + distanceToNumber(row.distance), 0);
  const totalPanic = dailyRows.reduce((sum, row) => sum + row.panic, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <SummaryCard value={dailyRows.length} label="Officers on duty" />
        <SummaryCard value={formatMinutes(totalDutyMinutes)} label="Duty hours" />
        <SummaryCard value={`${totalDistance.toFixed(1)} km`} label="Distance" />
        <SummaryCard value={totalAssigned} label="Assigned" />
        <SummaryCard value={totalCompleted} label="Completed" />
        <SummaryCard value={totalCancelled} label="Cancelled" />
        <SummaryCard value={totalPanic} label="Panic events" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Officer Daily Activity</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[930px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
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
                <tr key={`${row.name}-${row.date}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => onOfficerSelect?.(row.name)} className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left">
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-800 whitespace-nowrap">{row.shiftStart} → {row.shiftEnd}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{row.dutyHours}</td>
                  <td className="px-4 py-4 text-slate-700">{row.distance}</td>
                  <td className="px-4 py-4 font-semibold text-slate-800">{row.assigned}</td>
                  <td className="px-4 py-4"><span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{row.completed}</span></td>
                  <td className="px-4 py-4"><span className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${row.cancelled > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{row.cancelled}</span></td>
                  <td className="px-4 py-4">{row.panic}</td>
                </tr>
              ))}

              {sortedDailyRows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No officer activity found for the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500">Click an officer’s name to view details.</div>
      </div>
    </div>
  );
}

function SummaryCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}

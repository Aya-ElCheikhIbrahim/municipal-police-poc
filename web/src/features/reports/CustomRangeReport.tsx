import { useMemo, useState } from 'react';
import {
  dailyOfficerData,
  officerMissionData,
  officerPeriodData,
  type FilterState,
} from './mockData';

interface CustomRangeReportProps {
  filters: FilterState;
  onOfficerSelect?: (officerName: string) => void;
}

type CustomSortField =
  | 'name'
  | 'dutyPeriod'
  | 'dutyMinutes'
  | 'distanceKm'
  | 'assigned'
  | 'completed'
  | 'cancelled'
  | 'panic'
  | 'avgAcknowledgement'
  | 'avgCompletion';


function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function durationToMinutes(value: string) {
  if (value === '—') return -1;
  const hours = value.match(/(\d+)h/);
  const minutes = value.match(/(\d+)m/);
  const seconds = value.match(/(\d+)s/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0) + (seconds ? Number(seconds[1]) / 60 : 0);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}


function missionKey(mission: (typeof officerMissionData)[number]) {
  return mission.id;
}

function uniqueMissions(missions: typeof officerMissionData) {
  return Array.from(
    new Map(missions.map((mission) => [missionKey(mission), mission])).values()
  );
}

function averageAcknowledgement(missions: typeof officerMissionData) {
  const values = missions
    .filter((mission) => mission.acknowledgedAt !== '—')
    .map((mission) => timeToMinutes(mission.acknowledgedAt) - timeToMinutes(mission.assignedAt))
    .filter((value) => value >= 0);
  if (values.length === 0) return '—';
  const totalSeconds = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 60);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

function averageCompletion(missions: typeof officerMissionData) {
  const values = missions
    .filter((mission) => mission.completedAt !== '—')
    .map((mission) => timeToMinutes(mission.completedAt) - timeToMinutes(mission.assignedAt))
    .filter((value) => value >= 0);
  if (values.length === 0) return '—';
  const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return formatMinutes(avg);
}

function inRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function SortHeader({
  label,
  field,
  currentField,
  asc,
  onSort,
}: {
  label: string;
  field: CustomSortField;
  currentField: CustomSortField;
  asc: boolean;
  onSort: (field: CustomSortField) => void;
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

export function CustomRangeReport({ filters, onOfficerSelect }: CustomRangeReportProps) {
  const [sortField, setSortField] = useState<CustomSortField>('dutyMinutes');
  const [sortAsc, setSortAsc] = useState(false);

  const officerNames = Array.from(new Set(officerPeriodData.map((row) => row.officerName)))
    .filter((name) => filters.officer === 'ALL' || name === filters.officer);

  const rows = officerNames
    .map((name) => {
      const periodRows = officerPeriodData.filter(
        (row) => row.officerName === name && inRange(row.date, filters.startDate, filters.endDate)
      );

      const allRangeMissions = officerMissionData.filter(
        (mission) => mission.officerName === name && inRange(mission.date, filters.startDate, filters.endDate)
      );
      const rangeMissions = allRangeMissions.filter(
        (mission) => filters.location === 'ALL' || mission.location === filters.location
      );

      // With an area selected, only officers with missions in that area are included,
      // and mission counts/averages are calculated from those same missions.
      if (filters.location !== 'ALL' && rangeMissions.length === 0) return null;

      const daily = dailyOfficerData.find((row) => row.name === name);

      const dutyMinutes = periodRows.reduce((sum, row) => sum + row.dutyMinutes, 0);
      const distanceKm = periodRows.reduce((sum, row) => sum + row.distanceKm, 0);
      const panic = periodRows.reduce((sum, row) => sum + row.panicEvents, 0);
      const avgAcknowledgement = averageAcknowledgement(rangeMissions);
      const avgCompletion = averageCompletion(rangeMissions);

      return {
        name,
        dutyPeriod: daily ? `${daily.shiftStart} → ${daily.shiftEnd}` : '—',
        dutyMinutes,
        distanceKm,
        locationMissions: rangeMissions.length,
        assigned: rangeMissions.length,
        completed: rangeMissions.filter((m) => m.status === 'COMPLETED').length,
        cancelled: rangeMissions.filter((m) => m.status === 'CANCELLED').length,
        panic,
        avgAcknowledgement,
        avgCompletion,
        avgAcknowledgementMinutes: avgAcknowledgement === '—' ? -1 : durationToMinutes(avgAcknowledgement),
        avgCompletionMinutes: avgCompletion === '—' ? -1 : durationToMinutes(avgCompletion),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row && (row.dutyMinutes > 0 || row.assigned > 0)));

  const sortedRows = useMemo(() => {
    const getValue = (row: (typeof rows)[number]) => {
      switch (sortField) {
        case 'name': return row.name.toLowerCase();
        case 'dutyPeriod': return row.dutyPeriod === '—' ? '' : row.dutyPeriod.split(' → ')[0];
        case 'dutyMinutes': return row.dutyMinutes;
        case 'distanceKm': return row.distanceKm;
        case 'assigned': return row.assigned;
        case 'completed': return row.completed;
        case 'cancelled': return row.cancelled;
        case 'panic': return row.panic;
        case 'avgAcknowledgement': return row.avgAcknowledgementMinutes;
        case 'avgCompletion': return row.avgCompletionMinutes;
      }
    };

    return [...rows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const diff = typeof aValue === 'string' ? aValue.localeCompare(String(bValue)) : aValue - Number(bValue);
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortField, sortAsc]);

  const handleSort = (field: CustomSortField) => {
    if (sortField === field) setSortAsc((prev) => !prev);
    else {
      setSortField(field);
      setSortAsc(field === 'name' || field === 'dutyPeriod');
    }
  };

  const uniqueRangeMissions = uniqueMissions(
    officerMissionData.filter((mission) => {
      if (!inRange(mission.date, filters.startDate, filters.endDate)) return false;
      if (filters.officer !== 'ALL' && mission.officerName !== filters.officer) return false;
      if (filters.location !== 'ALL' && mission.location !== filters.location) return false;
      return true;
    })
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.dutyMinutes += row.dutyMinutes;
      acc.distanceKm += row.distanceKm;
      acc.panic += row.panic;
      return acc;
    },
    {
      dutyMinutes: 0,
      distanceKm: 0,
      assigned: uniqueRangeMissions.length,
      completed: uniqueRangeMissions.filter((mission) => mission.status === 'COMPLETED').length,
      cancelled: uniqueRangeMissions.filter((mission) => mission.status === 'CANCELLED').length,
      panic: 0,
    }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <SummaryCard value={rows.length} label="Officers" />
        <SummaryCard value={formatMinutes(totals.dutyMinutes)} label="Duty hours" />
        <SummaryCard value={`${totals.distanceKm.toFixed(1)} km`} label="Distance" />
        <SummaryCard value={totals.assigned} label="Assigned" />
        <SummaryCard value={totals.completed} label="Completed" />
        <SummaryCard value={totals.cancelled} label="Cancelled" />
        <SummaryCard value={totals.panic} label="Panic events" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Officer Activity</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[1080px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <SortHeader label="Officer" field="name" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Duty Period" field="dutyPeriod" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Duty Hours" field="dutyMinutes" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Distance" field="distanceKm" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                {filters.location !== 'ALL' && <th className="px-4 py-3">Missions at Location</th>}
                <SortHeader label="Assigned" field="assigned" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Completed" field="completed" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Cancelled" field="cancelled" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Panic" field="panic" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Acknowledgement" field="avgAcknowledgement" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Completion" field="avgCompletion" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOfficerSelect?.(row.name)} className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left">{row.name}</button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.dutyPeriod}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{formatMinutes(row.dutyMinutes)}</td>
                  <td className="px-4 py-3">{row.distanceKm.toFixed(1)} km</td>
                  {filters.location !== 'ALL' && (
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{row.locationMissions}</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-500">{filters.location}</div>
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold">{row.assigned}</td>
                  <td className="px-4 py-3"><span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{row.completed}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${row.cancelled > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{row.cancelled}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${row.panic > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{row.panic}</span></td>
                  <td className="px-4 py-3">{row.avgAcknowledgement}</td>
                  <td className="px-4 py-3">{row.avgCompletion}</td>
                </tr>
              ))}

              {sortedRows.length === 0 && (
                <tr><td colSpan={filters.location !== 'ALL' ? 11 : 10} className="px-5 py-10 text-center text-slate-400">No officer activity found in the selected date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-500">Click an officer’s name to view details.</div>
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

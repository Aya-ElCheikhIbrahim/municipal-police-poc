import { useMemo, useState } from 'react';
import {
  officerMissionData,
  officerPeriodData,
  type FilterState,
} from './mockData';

interface WeeklySummaryProps {
  filters?: FilterState;
  onOfficerSelect?: (officerName: string) => void;
}

type WeeklySort = 'dutyHours' | 'completed' | 'avgAcknowledgement' | 'avgTime' | 'panic';

function dateDaysBefore(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes)) return '—';
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

function formatAcknowledgement(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes)) return '—';
  const totalSeconds = Math.round(totalMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function durationToMinutes(value: string) {
  if (value === '—') return -1;
  const hours = value.match(/(\d+)h/);
  const minutes = value.match(/(\d+)m/);
  const seconds = value.match(/(\d+)s/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0) + (seconds ? Number(seconds[1]) / 60 : 0);
}

function averageAcknowledgement(missions: typeof officerMissionData) {
  const values = missions
    .filter((mission) => mission.acknowledgedAt !== '—')
    .map((mission) => timeToMinutes(mission.acknowledgedAt) - timeToMinutes(mission.assignedAt))
    .filter((value) => value >= 0);
  if (values.length === 0) return '—';
  return formatAcknowledgement(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageCompletion(missions: typeof officerMissionData) {
  const values = missions
    .filter((mission) => mission.completedAt !== '—')
    .map((mission) => timeToMinutes(mission.completedAt) - timeToMinutes(mission.assignedAt))
    .filter((value) => value >= 0);
  if (values.length === 0) return '—';
  return formatDuration(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function SortHeader({
  label,
  field,
  currentField,
  asc,
  onSort,
}: {
  label: string;
  field: WeeklySort;
  currentField: WeeklySort;
  asc: boolean;
  onSort: (field: WeeklySort) => void;
}) {
  return (
    <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100" onClick={() => onSort(field)}>
      {label} <span className="text-xs text-slate-400">{currentField === field ? (asc ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}

export function WeeklySummary({ filters, onOfficerSelect }: WeeklySummaryProps) {
  const [sortField, setSortField] = useState<WeeklySort>('completed');
  const [sortAsc, setSortAsc] = useState(false);

  const endDate = filters?.endDate || new Date().toISOString().slice(0, 10);
  const startDate = dateDaysBefore(endDate, 6);
  const officerFilter = filters?.officer ?? 'ALL';
  const locationFilter = filters?.location ?? 'ALL';

  const allWeekMissions = officerMissionData.filter((mission) => {
    if (mission.date < startDate || mission.date > endDate) return false;
    if (officerFilter !== 'ALL' && mission.officerName !== officerFilter) return false;
    return true;
  });

  const weeklyMissions = allWeekMissions.filter(
    (mission) => locationFilter === 'ALL' || mission.location === locationFilter
  );

  const officerNames = Array.from(
    new Set(
      officerPeriodData
        .filter((row) => row.date >= startDate && row.date <= endDate)
        .map((row) => row.officerName)
    )
  ).filter((name) => officerFilter === 'ALL' || name === officerFilter);

  const filteredData = officerNames
    .map((name) => {
      const periodRows = officerPeriodData.filter(
        (row) => row.officerName === name && row.date >= startDate && row.date <= endDate
      );
      const officerMissions = weeklyMissions.filter((mission) => mission.officerName === name);

      // When an area is selected, an officer is shown only if they actually had
      // a mission in that area during the selected week.
      if (locationFilter !== 'ALL' && officerMissions.length === 0) return null;

      const dutyMinutes = periodRows.reduce((sum, row) => sum + row.dutyMinutes, 0);
      const panic = periodRows.reduce((sum, row) => sum + row.panicEvents, 0);

      return {
        name,
        dutyHours: formatDuration(dutyMinutes),
        completed: officerMissions.filter((mission) => mission.status === 'COMPLETED').length,
        avgAcknowledgement: averageAcknowledgement(officerMissions),
        avgTime: averageCompletion(officerMissions),
        panic,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const sortedData = useMemo(() => {
    const getValue = (row: (typeof filteredData)[number]) => {
      switch (sortField) {
        case 'dutyHours': return durationToMinutes(row.dutyHours);
        case 'completed': return row.completed;
        case 'avgAcknowledgement': return durationToMinutes(row.avgAcknowledgement);
        case 'avgTime': return durationToMinutes(row.avgTime);
        case 'panic': return row.panic;
      }
    };

    return [...filteredData].sort((a, b) => {
      const diff = getValue(a) - getValue(b);
      return sortAsc ? diff : -diff;
    });
  }, [filteredData, sortField, sortAsc]);

  const handleSort = (field: WeeklySort) => {
    if (sortField === field) setSortAsc((prev) => !prev);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const totalCompleted = weeklyMissions.filter((m) => m.status === 'COMPLETED').length;
  const totalPanic = filteredData.reduce((acc, row) => acc + row.panic, 0);
  const avgAcknowledgement = averageAcknowledgement(weeklyMissions);
  const avgCompletion = averageCompletion(weeklyMissions);

  const priorityItems = [
    { label: 'Urgent', value: weeklyMissions.filter((m) => m.priority === 'URGENT').length },
    { label: 'High', value: weeklyMissions.filter((m) => m.priority === 'HIGH').length },
    { label: 'Low', value: weeklyMissions.filter((m) => m.priority === 'LOW').length },
  ];

  const statusItems = [
    { label: 'Completed', value: weeklyMissions.filter((m) => m.status === 'COMPLETED').length },
    { label: 'In Progress', value: weeklyMissions.filter((m) => m.status === 'IN_PROGRESS').length },
    { label: 'Cancelled', value: weeklyMissions.filter((m) => m.status === 'CANCELLED').length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard value={totalCompleted} label="Total completed missions" />
        <SummaryCard value={avgAcknowledgement} label="Avg acknowledgement" />
        <SummaryCard value={avgCompletion} label="Avg completion" />
        <SummaryCard value={totalPanic} label="Panic events" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard title="Missions by Status" items={statusItems} />
        <BreakdownCard title="Missions by Priority" items={priorityItems} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Officer Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[670px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <th className="px-4 py-3">Officer</th>
                <SortHeader label="Duty Hours" field="dutyHours" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Completed" field="completed" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Acknowledgement" field="avgAcknowledgement" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Completion" field="avgTime" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Panic" field="panic" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedData.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOfficerSelect?.(row.name)} className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left">{row.name}</button>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.dutyHours}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-100/70 px-2.5 py-1 font-bold text-emerald-700">
                      {row.completed}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.avgAcknowledgement}</td>
                  <td className="px-4 py-3">{row.avgTime}</td>
                  <td className="px-4 py-3">{row.panic}</td>
                </tr>
              ))}

              {sortedData.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No records match the selected filters.</td></tr>
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
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs">
      <h4 className="text-base font-semibold text-slate-700 mb-4">{title}</h4>
      <div className="space-y-3.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-sm text-slate-600 font-medium mb-1">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#203E72] rounded-full" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

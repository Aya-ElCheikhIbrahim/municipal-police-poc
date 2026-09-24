import { useEffect, useMemo, useState } from 'react';
import { fetchWeeklySummary } from './api';
import type { FilterState, WeeklySummaryResponse } from './types';

interface WeeklySummaryProps {
  filters?: FilterState;
  onOfficerSelect?: (officerName: string) => void;
}

type WeeklySort = 'name' | 'dutyHours' | 'completed' | 'avgAcknowledgement' | 'avgTime' | 'panic';

function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '—';
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

function formatAcknowledgement(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}m ${String(secs).padStart(2, '0')}s`;
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

export function WeeklySummary({ filters, onOfficerSelect }: WeeklySummaryProps) {
  const [sortField, setSortField] = useState<WeeklySort>('completed');
  const [sortAsc, setSortAsc] = useState(false);

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<WeeklySummaryResponse | null>(null);

  const endDate = filters?.endDate || new Date().toISOString().slice(0, 10);
  const startDate = filters?.startDate || endDate;

  useEffect(() => {
    setLoading(true);
    fetchWeeklySummary({
      start_date: startDate,
      end_date: endDate,
    })
      .then((data) => setSummaryData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const filteredData = useMemo(() => {
    if (!summaryData?.officers) return [];
    return summaryData.officers.map((officer) => ({
      id: officer.officer_id,
      name: officer.officer_name,
      dutyHours: formatDuration(officer.hours_on_duty * 60),
      dutyMinutes: officer.hours_on_duty * 60,
      completed: officer.missions_completed,
      avgAcknowledgement: formatAcknowledgement(officer.average_acknowledgement_seconds),
      avgAckSecs: officer.average_acknowledgement_seconds,
      avgTime: formatDuration(officer.average_completion_seconds / 60),
      avgCompSecs: officer.average_completion_seconds,
      panic: officer.panic_events,
    }));
  }, [summaryData]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'name': diff = a.name.localeCompare(b.name); break;
        case 'dutyHours': diff = a.dutyMinutes - b.dutyMinutes; break;
        case 'completed': diff = a.completed - b.completed; break;
        case 'avgAcknowledgement': diff = a.avgAckSecs - b.avgAckSecs; break;
        case 'avgTime': diff = a.avgCompSecs - b.avgCompSecs; break;
        case 'panic': diff = a.panic - b.panic; break;
      }
      return sortAsc ? diff : -diff;
    });
  }, [filteredData, sortField, sortAsc]);

  const handleSort = (field: WeeklySort) => {
    if (sortField === field) setSortAsc((prev) => !prev);
    else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-semibold">Loading weekly summary...</div>;
  }

  const totals = summaryData?.totals;

  const priorityItems = [
    { label: 'Urgent', value: summaryData?.missions_by_priority?.URGENT || summaryData?.missions_by_priority?.urgent || 0 },
    { label: 'High', value: summaryData?.missions_by_priority?.HIGH || summaryData?.missions_by_priority?.high || 0 },
    { label: 'Low', value: summaryData?.missions_by_priority?.LOW || summaryData?.missions_by_priority?.low || 0 },
  ];

  const statusItems = [
    { label: 'Completed', value: totals?.missions_completed ?? 0 },
    { label: 'In Progress', value: summaryData?.missions_by_status?.IN_PROGRESS || summaryData?.missions_by_status?.in_progress || 0 },
    { label: 'Cancelled', value: totals?.missions_cancelled ?? 0 },
  ];

  const typeItems = Object.entries(summaryData?.missions_by_category || {}).map(([category, value]) => ({
    label: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
    value: Number(value),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard value={totals?.missions_completed ?? 0} label="Total completed missions" />
        <SummaryCard value={formatAcknowledgement(summaryData?.average_acknowledgement_seconds ?? 0)} label="Avg acknowledgement" />
        <SummaryCard value={formatDuration((summaryData?.average_completion_seconds ?? 0) / 60)} label="Avg completion" />
        <SummaryCard value={totals?.panic_events ?? 0} label="Panic events" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownCard title="Missions by Status" items={statusItems} />
        <BreakdownCard title="Missions by Priority" items={priorityItems} />
        {typeItems.length > 0 ? (
          <BreakdownCard title="Missions by Type" items={typeItems} />
        ) : (
          <BreakdownCard
            title="Missions by Type"
            items={[
              { label: 'Security', value: 0 },
              { label: 'Traffic', value: 0 },
              { label: 'Patrol', value: 0 },
            ]}
          />
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Officer Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse min-w-[670px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs lg:text-sm border-b border-slate-100">
                <SortHeader label="Officer" field="name" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Duty Hours" field="dutyHours" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Completed" field="completed" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Acknowledgement" field="avgAcknowledgement" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Avg Completion" field="avgTime" currentField={sortField} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Panic" field="panic" currentField={sortField} asc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedData.map((row) => (
                <tr key={row.id || row.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOfficerSelect?.(row.name)}
                      className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.dutyHours}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-100/70 px-2.5 py-1 font-bold text-emerald-700">
                      {row.completed}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.avgAcknowledgement}</td>
                  <td className="px-4 py-3">{row.avgTime}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${row.panic > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
                      {row.panic}
                    </span>
                  </td>
                </tr>
              ))}

              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No records match the selected filters.
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
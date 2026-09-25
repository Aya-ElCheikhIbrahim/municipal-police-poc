import { useEffect, useMemo, useState } from 'react';
import { fetchWeeklySummary } from './api';
import type { Area, FilterState, WeeklySummaryResponse } from './types';

interface CustomRangeReportProps {
  filters: FilterState;
  areas?: Area[];
  onOfficerSelect?: (officerId: number) => void;
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
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
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
  field: CustomSortField;
  currentField: CustomSortField;
  asc: boolean;
  onSort: (field: CustomSortField) => void;
}) {
  return (
    <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        <span className="text-[11px] leading-none text-slate-400">
          {currentField === field ? (asc ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}

export function CustomRangeReport({ filters, areas, onOfficerSelect }: CustomRangeReportProps) {
  const [sortField, setSortField] = useState<CustomSortField>('dutyMinutes');
  const [sortAsc, setSortAsc] = useState(false);

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<WeeklySummaryResponse | null>(null);

  const areaId = filters.location !== 'ALL' ? Number(filters.location) : undefined;
  const areaName =
    filters.location === 'ALL' ? '' : areas?.find((a) => String(a.id) === filters.location)?.name ?? filters.location;

  useEffect(() => {
    setLoading(true);
    fetchWeeklySummary({
      start_date: filters.startDate,
      end_date: filters.endDate,
      area_id: areaId,
    })
      .then((data) => setSummaryData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.startDate, filters.endDate, areaId]);

  const rows = useMemo(() => {
    if (!summaryData?.officers) return [];
    return summaryData.officers.map((officer) => ({
      id: officer.officer_id,
      name: officer.officer_name,
      dutyPeriod: 'Range Total',
      dutyMinutes: officer.hours_on_duty * 60,
      distanceKm: officer.distance_covered_m / 1000,
      assigned: officer.missions_assigned,
      completed: officer.missions_completed,
      cancelled: officer.missions_cancelled,
      panic: officer.panic_events,
      avgAcknowledgement: formatAcknowledgement(officer.average_acknowledgement_seconds),
      avgAckSecs: officer.average_acknowledgement_seconds,
      avgCompletion: formatMinutes(officer.average_completion_seconds / 60),
      avgCompSecs: officer.average_completion_seconds,
    }));
  }, [summaryData]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'name': diff = a.name.localeCompare(b.name); break;
        case 'dutyMinutes': diff = a.dutyMinutes - b.dutyMinutes; break;
        case 'distanceKm': diff = a.distanceKm - b.distanceKm; break;
        case 'assigned': diff = a.assigned - b.assigned; break;
        case 'completed': diff = a.completed - b.completed; break;
        case 'cancelled': diff = a.cancelled - b.cancelled; break;
        case 'panic': diff = a.panic - b.panic; break;
        case 'avgAcknowledgement': diff = a.avgAckSecs - b.avgAckSecs; break;
        case 'avgCompletion': diff = a.avgCompSecs - b.avgCompSecs; break;
      }
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-semibold">Loading range report...</div>;
  }

  const totals = summaryData?.totals || {
    officers: 0,
    hours_on_duty: 0,
    distance_covered_m: 0,
    missions_assigned: 0,
    missions_completed: 0,
    missions_cancelled: 0,
    panic_events: 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <SummaryCard value={totals.officers} label="Officers" />
        <SummaryCard value={formatMinutes(totals.hours_on_duty * 60)} label="Duty hours" />
        <SummaryCard value={`${(totals.distance_covered_m / 1000).toFixed(1)} km`} label="Distance" />
        <SummaryCard value={totals.missions_assigned} label="Assigned" />
        <SummaryCard value={totals.missions_completed} label="Completed" />
        <SummaryCard value={totals.missions_cancelled} label="Cancelled" />
        <SummaryCard value={totals.panic_events} label="Panic events" />
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
                <tr key={row.id || row.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOfficerSelect?.(row.id)}
                      className="text-[#203E72] hover:text-[#142d55] hover:underline font-bold cursor-pointer text-left"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{row.dutyPeriod}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{formatMinutes(row.dutyMinutes)}</td>
                  <td className="px-4 py-3">{row.distanceKm.toFixed(1)} km</td>
                  {filters.location !== 'ALL' && (
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{row.assigned}</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-500">{areaName}</div>
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold">{row.assigned}</td>
                  <td className="px-4 py-3"><span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{row.completed}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 font-bold ${row.cancelled > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{row.cancelled}</span></td>
                  <td className="px-4 py-3">{row.panic}</td>
                  <td className="px-4 py-3">{row.avgAcknowledgement}</td>
                  <td className="px-4 py-3">{row.avgCompletion}</td>
                </tr>
              ))}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={filters.location !== 'ALL' ? 11 : 10} className="px-5 py-10 text-center text-slate-400">
                    No officer activity found in the selected date range.
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
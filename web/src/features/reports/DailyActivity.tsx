import { useState } from 'react';
import { dailyOfficerData, type SeverityFilter, type FilterState } from './mockData';

interface DailyActivityProps {
  filters?: FilterState;
  ignoreGlobalDate?: boolean;
}

type SortField = 'name' | 'dutyHours' | 'completed' | 'panic';

export function DailyActivity({ filters, ignoreGlobalDate = false }: DailyActivityProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const filteredData = dailyOfficerData.filter((row) => {
    if (!ignoreGlobalDate && row.date !== dailyDate) return false;
    if (!filters) return true;

    if (filters.officer !== 'ALL' && row.name !== filters.officer) return false;
    if (filters.reportType !== 'ALL' && row.reportType !== filters.reportType) return false;
    if (filters.priority !== 'ALL' && row.priority !== filters.priority) return false;
    if (filters.shift !== 'ALL' && row.shift !== filters.shift) return false;
    if (filters.location !== 'ALL' && row.location !== filters.location) return false;
    if (filters.status !== 'ALL' && row.status !== filters.status) return false;

    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let valA: string | number = a[sortField] as string | number;
    let valB: string | number = b[sortField] as string | number;

    if (sortField === 'completed') {
      valA = a.completed[severityFilter];
      valB = b.completed[severityFilter];
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const summaryAssigned = filteredData.reduce((acc, row) => acc + row.assigned[severityFilter], 0);
  const summaryCompleted = filteredData.reduce((acc, row) => acc + row.completed[severityFilter], 0);

  return (
    <div className="space-y-4">
      {/* Local Daily Selector & Severity Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white/70 p-2 rounded-md border border-slate-200/70 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Severity Filter:
          </span>
          {(['ALL', 'URGENT', 'HIGH', 'LOW'] as SeverityFilter[]).map((level) => (
            <button
              key={level}
              onClick={() => setSeverityFilter(level)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                severityFilter === level
                  ? 'bg-[#1F3864] text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              {level === 'ALL' ? 'All' : level.charAt(0) + level.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {!ignoreGlobalDate && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Focus Day:</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700"
            />
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">{filteredData.length}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Officers on duty</div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">{summaryAssigned}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Missions assigned ({severityFilter.toLowerCase()})
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">{summaryCompleted}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Completed</div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">
            {filteredData.reduce((acc, row) => acc + row.panic, 0)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Panic events</div>
        </div>
      </div>

      {/* Sortable Officers Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[175px]">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <th className="p-3.5 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                Officer {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="p-3.5">Shift</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Priority</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('dutyHours')}>
                Duty Hours {sortField === 'dutyHours' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('completed')}>
                Completed {sortField === 'completed' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('panic')}>
                Panic {sortField === 'panic' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900">{row.name}</td>
                <td className="p-3.5 capitalize">{row.shift.toLowerCase()}</td>
                <td className="p-3.5">{row.location}</td>
                <td className="p-3.5">{row.reportType}</td>
                <td className="p-3.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.priority === 'URGENT'
                        ? 'bg-rose-100 text-rose-800'
                        : row.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {row.priority}
                  </span>
                </td>
                <td className="p-3.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      row.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : row.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {row.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3.5">{row.dutyHours}</td>
                <td className="p-3.5 font-bold">{row.completed[severityFilter]}</td>
                <td className="p-3.5">{row.panic}</td>
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">
                  No records match the active parameters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
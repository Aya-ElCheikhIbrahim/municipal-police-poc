import { useState } from 'react';
import { weeklyOfficerData, type FilterState } from './mockData';

interface WeeklySummaryProps {
  filters?: FilterState;
}

type WeeklySort = 'name' | 'completed' | 'avgTime';

export function WeeklySummary({ filters }: WeeklySummaryProps) {
  const [sortField, setSortField] = useState<WeeklySort>('completed');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const filteredData = weeklyOfficerData.filter((row) => {
    if (!filters) return true;

    if (filters.officer !== 'ALL' && row.name !== filters.officer) return false;
    if (filters.shift !== 'ALL' && row.shift !== filters.shift) return false;
    if (filters.location !== 'ALL' && row.location !== filters.location) return false;
    if (filters.priority !== 'ALL' && row.priority !== filters.priority) return false;
    if (filters.reportType !== 'ALL' && row.reportType !== filters.reportType) return false;

    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: WeeklySort) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const totalCompleted = filteredData.reduce((acc, row) => acc + row.completed, 0);

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">{totalCompleted}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Total completed missions</div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">4m 12s</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Avg acknowledgement</div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">38m</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Avg completion</div>
        </div>
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">2</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Panic events</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Priority Breakdown */}
        <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs space-y-4">
          <h4 className="text-xs font-semibold text-slate-600">Missions by Priority</h4>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Urgent</span>
                <span className="font-bold text-slate-800">14</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-rose-600 h-2 rounded-full" style={{ width: '42%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>High</span>
                <span className="font-bold text-slate-800">27</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Low</span>
                <span className="font-bold text-slate-800">22</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-slate-400 h-2 rounded-full" style={{ width: '66%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sortable Weekly Leaderboard Table */}
        <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <h4 className="text-xs font-semibold text-slate-600 mb-3">Sortable Officer Performance</h4>

          <div className="border border-slate-100 rounded-md overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                    Officer {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('completed')}>
                    Completed {sortField === 'completed' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('avgTime')}>
                    Avg Time {sortField === 'avgTime' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="p-3 capitalize">{row.shift.toLowerCase()}</td>
                    <td className="p-3">{row.location}</td>
                    <td className="p-3 font-medium">{row.completed}</td>
                    <td className="p-3 text-slate-500">{row.avgTime}</td>
                  </tr>
                ))}
                {sortedData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">
                      No records match the active criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
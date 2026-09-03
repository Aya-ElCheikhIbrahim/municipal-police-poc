import { useState } from 'react';
import { dailyOfficerData,type SeverityFilter } from './mockData';

export function DailyActivity() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');

  const summaryAssigned = dailyOfficerData.reduce((acc, row) => acc + row.assigned[severityFilter], 0);
  const summaryCompleted = dailyOfficerData.reduce((acc, row) => acc + row.completed[severityFilter], 0);

  return (
    <div className="space-y-4">
      {/* Severity Filter Controls */}
      <div className="flex items-center gap-2 bg-white/70 p-1 rounded-md border border-slate-200/70 w-fit shadow-xs">
        <span className="text-[11px] font-semibold text-slate-500 px-2 uppercase tracking-wide">
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

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
          <div className="text-2xl font-bold text-slate-900">4</div>
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
          <div className="text-2xl font-bold text-slate-900">1</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Panic events</div>
        </div>
      </div>

      {/* Officers Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <th className="p-3.5">Officer</th>
              <th className="p-3.5">Hours on duty</th>
              <th className="p-3.5">Distance</th>
              <th className="p-3.5">Assigned</th>
              <th className="p-3.5">Completed</th>
              <th className="p-3.5">Cancelled</th>
              <th className="p-3.5">Panic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {dailyOfficerData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900">{row.name}</td>
                <td className="p-3.5">{row.dutyHours}</td>
                <td className="p-3.5">{row.distance}</td>
                <td className="p-3.5 font-bold">{row.assigned[severityFilter]}</td>
                <td className="p-3.5">{row.completed[severityFilter]}</td>
                <td className="p-3.5">{row.cancelled[severityFilter]}</td>
                <td className="p-3.5">{row.panic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
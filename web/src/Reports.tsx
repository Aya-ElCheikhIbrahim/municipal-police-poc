import { useState } from 'react';
import type { ReportSubTab, SeverityFilter } from './types';

export default function Reports() {
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('Daily activity');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');

  const getFormattedToday = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('en-US', { month: 'short' });
    const year = today.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getFormattedWeekRange = () => {
    const today = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(today.getDate() - 6);

    const startDay = startOfWeek.getDate();
    const startMonth = startOfWeek.toLocaleString('en-US', { month: 'short' });

    const endDay = today.getDate();
    const endMonth = today.toLocaleString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startDay} – ${endDay} ${endMonth}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  };

  const dailyOfficerData = [
    {
      name: 'Karim Haddad',
      dutyHours: '7h 42m',
      distance: '18.4 km',
      assigned: { ALL: 6, URGENT: 1, HIGH: 2, LOW: 3 },
      completed: { ALL: 5, URGENT: 1, HIGH: 2, LOW: 2 },
      cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
      panic: 1,
    },
    {
      name: 'Layla Mansour',
      dutyHours: '8h 01m',
      distance: '22.1 km',
      assigned: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
      completed: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
      cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
      panic: 0,
    },
    {
      name: 'Samir Youssef',
      dutyHours: '6h 30m',
      distance: '14.7 km',
      assigned: { ALL: 4, URGENT: 1, HIGH: 1, LOW: 2 },
      completed: { ALL: 3, URGENT: 1, HIGH: 0, LOW: 2 },
      cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      panic: 0,
    },
    {
      name: 'Nabil Khoury',
      dutyHours: '5h 15m',
      distance: '11.2 km',
      assigned: { ALL: 3, URGENT: 0, HIGH: 2, LOW: 1 },
      completed: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
      panic: 0,
    },
  ];

  const weeklyOfficerData = [
    { name: 'Layla Mansour', completed: 28, avgTime: '31m' },
    { name: 'Karim Haddad', completed: 24, avgTime: '36m' },
    { name: 'Samir Youssef', completed: 19, avgTime: '42m' },
    { name: 'Nabil Khoury', completed: 14, avgTime: '47m' },
  ];

  const summaryAssigned = dailyOfficerData.reduce((acc, row) => acc + row.assigned[severityFilter], 0);
  const summaryCompleted = dailyOfficerData.reduce((acc, row) => acc + row.completed[severityFilter], 0);

  return (
    <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/80 p-0.5 rounded-md border border-slate-200 flex items-center">
            <button
              onClick={() => setReportSubTab('Daily activity')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                reportSubTab === 'Daily activity'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Daily activity
            </button>
            <button
              onClick={() => setReportSubTab('Weekly summary')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                reportSubTab === 'Weekly summary'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Weekly summary
            </button>
          </div>

          <div className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-medium text-slate-700 shadow-xs">
            {reportSubTab === 'Daily activity' ? getFormattedToday() : getFormattedWeekRange()}
          </div>

          {reportSubTab === 'Daily activity' && (
            <div className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-medium text-slate-700 shadow-xs cursor-pointer">
              All officers
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer">
            Export CSV
          </button>
          <button className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer">
            Export PDF
          </button>
        </div>
      </div>

      {reportSubTab === 'Daily activity' && (
        <div className="space-y-4">
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
      )}

      {reportSubTab === 'Weekly summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur p-4 rounded-lg border border-slate-200/80 shadow-xs">
              <div className="text-2xl font-bold text-slate-900">96</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">Total missions</div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs space-y-4">
              <h4 className="text-xs font-semibold text-slate-600">Missions by priority</h4>

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
                    <span>Medium</span>
                    <span className="font-bold text-slate-800">33</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-[#1F3864] h-2 rounded-full" style={{ width: '100%' }}></div>
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

            <div className="bg-white p-5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <h4 className="text-xs font-semibold text-slate-600 mb-3">Most missions completed</h4>

              <div className="border border-slate-100 rounded-md overflow-hidden flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <th className="p-3">Officer</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3">Avg time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {weeklyOfficerData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="p-3 font-medium">{row.completed}</td>
                        <td className="p-3 text-slate-500">{row.avgTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import {type ReportSubTab } from './mockData';
import { DailyActivity } from './DailyActivity';
import { WeeklySummary } from './WeeklySummary';

export function ReportsPage() {
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('Daily activity');

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

  return (
    <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto space-y-4">
      {/* Header Actions & Sub-nav */}
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

      {/* Tab Panels */}
      {reportSubTab === 'Daily activity' ? <DailyActivity /> : <WeeklySummary />}
    </div>
  );
}
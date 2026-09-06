import { useState } from 'react';
import {
  type ReportSubTab,
  type FilterState,
  dailyOfficerData,
  TRIPOLI_SPECIFIC_LOCATIONS,
} from './mockData';
import { DailyActivity } from './DailyActivity';
import { WeeklySummary } from './WeeklySummary';

export function ReportsPage() {
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('Daily activity');

  const todayStr = new Date().toISOString().split('T')[0];

  const [filters, setFilters] = useState<FilterState>({
    officer: 'ALL',
    reportType: 'ALL',
    priority: 'ALL',
    startDate: todayStr,
    endDate: todayStr,
    shift: 'ALL',
    location: 'ALL',
    status: 'ALL',
  });

  const officerOptions = Array.from(new Set(dailyOfficerData.map((d) => d.name)));

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      officer: 'ALL',
      reportType: 'ALL',
      priority: 'ALL',
      startDate: todayStr,
      endDate: todayStr,
      shift: 'ALL',
      location: 'ALL',
      status: 'ALL',
    });
  };

  // Saved Presets
  const applyPresetUrgentToday = () => {
    setFilters({
      officer: 'ALL',
      reportType: 'ALL',
      priority: 'URGENT',
      startDate: todayStr,
      endDate: todayStr,
      shift: 'ALL',
      location: 'ALL',
      status: 'ALL',
    });
    setReportSubTab('Daily activity');
  };

  const applyPresetWeeklyPerformance = () => {
    const priorWeek = new Date();
    priorWeek.setDate(priorWeek.getDate() - 7);
    setFilters({
      officer: 'ALL',
      reportType: 'ALL',
      priority: 'ALL',
      startDate: priorWeek.toISOString().split('T')[0],
      endDate: todayStr,
      shift: 'ALL',
      location: 'ALL',
      status: 'COMPLETED',
    });
    setReportSubTab('Weekly summary');
  };

  // Export filtered items only
  const handleExportFiltered = (format: 'CSV' | 'PDF') => {
    const exportCount = dailyOfficerData.filter((row) => {
      if (filters.officer !== 'ALL' && row.name !== filters.officer) return false;
      if (filters.reportType !== 'ALL' && row.reportType !== filters.reportType) return false;
      if (filters.priority !== 'ALL' && row.priority !== filters.priority) return false;
      if (filters.shift !== 'ALL' && row.shift !== filters.shift) return false;
      if (filters.location !== 'ALL' && row.location !== filters.location) return false;
      if (filters.status !== 'ALL' && row.status !== filters.status) return false;
      return true;
    }).length;

    alert(`Exporting ${exportCount} currently filtered record(s) as ${format}.`);
  };

  return (
    <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto space-y-4">
      {/* Header Actions & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <button
            onClick={() => setReportSubTab('Date range report')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              reportSubTab === 'Date range report'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Date range report (&gt;1 week)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportFiltered('CSV')}
            className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            Export Filtered CSV
          </button>
          <button
            onClick={() => handleExportFiltered('PDF')}
            className="bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            Export Filtered PDF
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white/90 backdrop-blur p-3.5 rounded-lg border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Filter Reports
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-400 font-medium">Presets:</span>
            <button
              onClick={applyPresetUrgentToday}
              className="text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-medium transition-colors"
            >
              Today’s urgent missions
            </button>
            <button
              onClick={applyPresetWeeklyPerformance}
              className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium transition-colors"
            >
              Weekly officer performance
            </button>
          </div>
          <button
            onClick={resetFilters}
            className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer underline"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Officer */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Officer</label>
            <select
              value={filters.officer}
              onChange={(e) => handleFilterChange('officer', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Officers</option>
              {officerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Mission Category */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Category</label>
            <select
              value={filters.reportType}
              onChange={(e) => handleFilterChange('reportType', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Categories</option>
              <option value="PATROL">Patrol</option>
              <option value="INCIDENT">Incident</option>
              <option value="TRAFFIC">Traffic</option>
              <option value="INSPECTION">Inspection</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Adjacent Start Date & End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Shift */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Shift</label>
            <select
              value={filters.shift}
              onChange={(e) => handleFilterChange('shift', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Shifts</option>
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
          </div>

          {/* Tripoli Locations */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Location</label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Locations</option>
              {TRIPOLI_SPECIFIC_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      {reportSubTab === 'Daily activity' && <DailyActivity filters={filters} />}
      {reportSubTab === 'Weekly summary' && <WeeklySummary filters={filters} />}
      {reportSubTab === 'Date range report' && (
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-sm">Date Range Multi-Week Report</h3>
            <p className="text-xs text-slate-500">
              Viewing missions aggregated from {filters.startDate} to {filters.endDate}.
            </p>
          </div>
          <DailyActivity filters={filters} ignoreGlobalDate={true} />
        </div>
      )}
    </div>
  );
}
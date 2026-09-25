import { useState, useEffect, type ReactNode } from 'react';
import { type ReportSubTab, type FilterState } from './types.ts';
import { TRIPOLI_LOCATIONS } from '../../data/tripoliLocations';
import { DailyActivity, type DailyViewMode } from './DailyActivity';
import { WeeklySummary } from './WeeklySummary';
import { OfficerReport } from './OfficerReport';
import { CustomRangeReport } from './CustomRangeReport';
import { MissionsReport } from './MissionsReport';
import {
  exportDailyCSV,
  exportDailyPDF,
  exportWeeklyCSV,
  exportWeeklyPDF,
  fetchDailySummary,
} from './api';

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ReportsView = ReportSubTab | 'Missions';

interface ReportsPageProps {
  onMissionSelect: (missionId: number) => void;
}

export function ReportsPage({ onMissionSelect }: ReportsPageProps) {
  const [reportSubTab, setReportSubTab] = useState<ReportsView>('Daily activity');
  const [dailyView, setDailyView] = useState<DailyViewMode>('SUMMARY');
  const [selectedOfficer, setSelectedOfficer] = useState<string | null>(null);
  const [officerList, setOfficerList] = useState<{ id: number; name: string }[]>([]);

  const todayStr = getLocalDateString(new Date());

  const [filters, setFilters] = useState<FilterState>({
    officer: 'ALL',
    reportType: 'ALL',
    priority: 'ALL',
    startDate: todayStr,
    endDate: todayStr,
    location: 'ALL',
    status: 'ALL',
    fromTime: '',
    toTime: '',
  });

  // Fetch live officer list dynamically from backend daily summary
  useEffect(() => {
    fetchDailySummary({ date: filters.startDate })
      .then((data) => {
        if (data?.officers) {
          const list = data.officers.map((o) => ({
            id: o.officer_id,
            name: o.officer_name,
          }));
          setOfficerList(list);
        }
      })
      .catch(console.error);
  }, [filters.startDate]);

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
      location: 'ALL',
      status: 'ALL',
      fromTime: '',
      toTime: '',
    });
  };

  const handleTabChange = (tab: ReportsView) => {
    setReportSubTab(tab);
    setSelectedOfficer(null);
    setFilters((prev) => ({
      ...prev,
      status: 'ALL',
      reportType: 'ALL',
      priority: 'ALL',
      fromTime: '',
      toTime: '',
      location: tab === 'Weekly summary' ? 'ALL' : prev.location,
    }));
  };

  const handleDailyViewChange = (view: DailyViewMode) => {
    setDailyView(view);
    setSelectedOfficer(null);
    setFilters((prev) => ({
      ...prev,
      status: 'ALL',
      fromTime: '',
      toTime: '',
    }));
  };

  const handleExportFiltered = (format: 'CSV' | 'PDF') => {
    const activeOfficerId = filters.officer !== 'ALL' ? Number(filters.officer) : undefined;
    try {
      if (reportSubTab === 'Daily activity') {
        if (format === 'CSV') exportDailyCSV(filters.startDate, activeOfficerId, filters.status);
        else exportDailyPDF(filters.startDate, activeOfficerId, filters.status);
      } else if (reportSubTab === 'Weekly summary' || reportSubTab === 'Custom range') {
        if (format === 'CSV') exportWeeklyCSV(filters.startDate, filters.endDate);
        else exportWeeklyPDF(filters.startDate, filters.endDate);
      } else {
        if (format === 'CSV') exportDailyCSV(filters.startDate, activeOfficerId, filters.status);
        else exportDailyPDF(filters.startDate, activeOfficerId, filters.status);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (selectedOfficer) {
    return (
      <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto">
        <OfficerReport
          officerName={selectedOfficer}
          sourceTab={reportSubTab === 'Missions' ? 'Daily activity' : reportSubTab}
          filters={filters}
          onBack={() => setSelectedOfficer(null)}
          onMissionSelect={onMissionSelect}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#EAEFF5] p-6 overflow-y-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/80 p-0.5 rounded-md border border-slate-200 flex items-center">
            {(['Daily activity', 'Weekly summary', 'Custom range'] as ReportSubTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold transition-all cursor-pointer ${
                  reportSubTab === tab
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleTabChange('Missions')}
            className={`ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border ${
              reportSubTab === 'Missions'
                ? 'bg-[#203E72] text-white border-[#203E72] shadow-sm'
                : 'bg-blue-50 text-[#203E72] border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" />
            Mission Overview
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportFiltered('CSV')}
            className="bg-white hover:bg-slate-50 border border-slate-200 px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            Export Filtered CSV
          </button>
          <button
            type="button"
            onClick={() => handleExportFiltered('PDF')}
            className="bg-white hover:bg-slate-50 border border-slate-200 px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            Export Filtered PDF
          </button>
        </div>
      </div>

      {reportSubTab === 'Daily activity' && (
        <div className="inline-flex bg-white/80 p-0.5 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => handleDailyViewChange('SUMMARY')}
            className={`px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold cursor-pointer ${
              dailyView === 'SUMMARY'
                ? 'bg-[#1F3864] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Daily Summary
          </button>
          <button
            type="button"
            onClick={() => handleDailyViewChange('SNAPSHOT')}
            className={`px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold cursor-pointer ${
              dailyView === 'SNAPSHOT'
                ? 'bg-[#1F3864] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Time Snapshot
          </button>
        </div>
      )}

      {reportSubTab !== 'Missions' && (
        <div>
          <div className="bg-white/90 backdrop-blur rounded-lg border border-slate-200/80 shadow-xs">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                Filter Report
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm text-slate-500 hover:text-slate-800 font-medium cursor-pointer underline"
              >
                Clear
              </button>
            </div>

            <div className="p-4">
              {reportSubTab === 'Daily activity' && dailyView === 'SUMMARY' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
                  <DateFilter
                    value={filters.startDate}
                    max={todayStr}
                    onChange={(value) => {
                      handleFilterChange('startDate', value);
                      handleFilterChange('endDate', value);
                    }}
                  />
                  <OfficerFilter
                    value={filters.officer}
                    options={officerList}
                    onChange={(value) => handleFilterChange('officer', value)}
                  />
                  <LocationFilter
                    value={filters.location}
                    onChange={(value) => handleFilterChange('location', value)}
                  />
                </div>
              )}

              {reportSubTab === 'Daily activity' && dailyView === 'SNAPSHOT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <DateFilter
                    value={filters.startDate}
                    max={todayStr}
                    onChange={(value) => {
                      handleFilterChange('startDate', value);
                      handleFilterChange('endDate', value);
                    }}
                  />
                  <FilterField label="From Time">
                    <input
                      type="time"
                      value={filters.fromTime}
                      max={filters.toTime || undefined}
                      onChange={(e) => handleFilterChange('fromTime', e.target.value)}
                      className="filter-control"
                    />
                  </FilterField>
                  <FilterField label="To Time">
                    <input
                      type="time"
                      value={filters.toTime}
                      min={filters.fromTime || undefined}
                      onChange={(e) => handleFilterChange('toTime', e.target.value)}
                      className="filter-control"
                    />
                  </FilterField>
                  <LocationFilter
                    value={filters.location}
                    onChange={(value) => handleFilterChange('location', value)}
                  />
                  <OfficerFilter
                    value={filters.officer}
                    options={officerList}
                    onChange={(value) => handleFilterChange('officer', value)}
                  />
                </div>
              )}

              {reportSubTab === 'Weekly summary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
                  <FilterField label="Week">
                    <CalendarDateInput
                      value={filters.endDate}
                      max={todayStr}
                      onChange={(value) => handleFilterChange('endDate', value)}
                    />
                  </FilterField>
                  <OfficerFilter
                    value={filters.officer}
                    options={officerList}
                    onChange={(value) => handleFilterChange('officer', value)}
                  />
                  <LocationFilter
                    value={filters.location}
                    onChange={(value) => handleFilterChange('location', value)}
                  />
                </div>
              )}

              {reportSubTab === 'Custom range' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FilterField label="Start Date">
                    <CalendarDateInput
                      value={filters.startDate}
                      max={filters.endDate || todayStr}
                      onChange={(value) => handleFilterChange('startDate', value)}
                    />
                  </FilterField>
                  <FilterField label="End Date">
                    <CalendarDateInput
                      value={filters.endDate}
                      min={filters.startDate}
                      max={todayStr}
                      onChange={(value) => handleFilterChange('endDate', value)}
                    />
                  </FilterField>
                  <OfficerFilter
                    value={filters.officer}
                    options={officerList}
                    onChange={(value) => handleFilterChange('officer', value)}
                  />
                  <LocationFilter
                    value={filters.location}
                    onChange={(value) => handleFilterChange('location', value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reportSubTab === 'Daily activity' && (
        <DailyActivity
          filters={filters as any}
          mode={dailyView}
          onOfficerSelect={setSelectedOfficer}
        />
      )}

      {reportSubTab === 'Weekly summary' && (
        <WeeklySummary filters={filters as any} onOfficerSelect={setSelectedOfficer} />
      )}

      {reportSubTab === 'Custom range' && (
        <CustomRangeReport filters={filters as any} onOfficerSelect={setSelectedOfficer} />
      )}

      {reportSubTab === 'Missions' && (
        <MissionsReport onMissionSelect={onMissionSelect} />
      )}

      <style>{`
        .filter-control {
          width: 100%;
          background: rgb(248 250 252);
          border: 1px solid rgb(226 232 240);
          border-radius: 0.375rem;
          padding: 0.5rem 0.625rem;
          font-size: 1rem;
          color: rgb(51 65 85);
          outline: none;
        }
        .filter-control:focus { box-shadow: 0 0 0 1px rgb(148 163 184); }
      `}</style>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function DateFilter({ value, max, onChange }: { value: string; max: string; onChange: (value: string) => void }) {
  return (
    <FilterField label="Date">
      <CalendarDateInput value={value} max={max} onChange={onChange} />
    </FilterField>
  );
}

function CalendarDateInput({
  value,
  min,
  max,
  onChange,
  className = '',
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="YYYY-MM-DD"
        onChange={(e) => onChange(e.target.value)}
        className="filter-control pr-10"
        aria-label="Date"
      />
      <input
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0"
        aria-label="Open calendar"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    </div>
  );
}

function OfficerFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: number; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FilterField label="Officer">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="filter-control">
        <option value="ALL">All Officers</option>
        {options.map((off) => (
          <option key={off.id} value={String(off.id)}>
            {off.name}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

function LocationFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FilterField label="Area / Location">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="filter-control">
        <option value="ALL">All Areas</option>
        {TRIPOLI_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
      </select>
    </FilterField>
  );
}
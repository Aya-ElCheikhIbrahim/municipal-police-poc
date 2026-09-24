import { apiClient } from '../../shared/api/client';
import type {
  ActivityRow,
  DailySummaryResponse,
  OfficerReportResponse,
  WeeklySummaryResponse,
} from './types';

// Helper for downloadable files (CSV / PDF binary responses)
export async function downloadReportFile(endpoint: string, defaultFilename: string) {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/v1${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------
// Backend Data Endpoints using shared apiClient
// ------------------------------------------------------------------

export async function fetchDailySummary(params: {
  date: string;
  status?: string;
  area_id?: number;
}): Promise<DailySummaryResponse> {
  const query = new URLSearchParams();
  query.append('date', params.date);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.area_id) query.append('area_id', String(params.area_id));

  return apiClient.get<DailySummaryResponse>(`/reports/daily/summary/?${query.toString()}`);
}

export async function fetchActivityFeed(params: {
  date: string;
  from_time?: string;
  to_time?: string;
  officer_id?: number;
  area_id?: number;
}): Promise<ActivityRow[]> {
  const query = new URLSearchParams();
  query.append('date', params.date);
  if (params.from_time) query.append('from_time', params.from_time);
  if (params.to_time) query.append('to_time', params.to_time);
  if (params.officer_id) query.append('officer_id', String(params.officer_id));
  if (params.area_id) query.append('area_id', String(params.area_id));

  return apiClient.get<ActivityRow[]>(`/reports/activity/?${query.toString()}`);
}

export async function fetchWeeklySummary(params: {
  start_date: string;
  end_date: string;
  officer_id?: number;
  area_id?: number;
}): Promise<WeeklySummaryResponse> {
  const query = new URLSearchParams();
  query.append('start_date', params.start_date);
  query.append('end_date', params.end_date);
  if (params.officer_id) query.append('officer_id', String(params.officer_id));
  if (params.area_id) query.append('area_id', String(params.area_id));

  return apiClient.get<WeeklySummaryResponse>(`/reports/weekly/?${query.toString()}`);
}

export async function fetchOfficerReport(params: {
  officer_id: number;
  start_date: string;
  end_date: string;
  status?: string;
}): Promise<OfficerReportResponse> {
  const query = new URLSearchParams();
  query.append('officer_id', String(params.officer_id));
  query.append('start_date', params.start_date);
  query.append('end_date', params.end_date);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);

  return apiClient.get<OfficerReportResponse>(`/reports/officer/?${query.toString()}`);
}

// ------------------------------------------------------------------
// Export Triggers
// ------------------------------------------------------------------

export function exportDailyCSV(date: string, officerId: number, status?: string) {
  const query = new URLSearchParams({ date, officer_id: String(officerId) });
  if (status && status !== 'ALL') query.append('status', status);
  return downloadReportFile(`/reports/daily/export/csv/?${query.toString()}`, `daily_report_${date}.csv`);
}

export function exportDailyPDF(date: string, officerId: number, status?: string) {
  const query = new URLSearchParams({ date, officer_id: String(officerId) });
  if (status && status !== 'ALL') query.append('status', status);
  return downloadReportFile(`/reports/daily/export/pdf/?${query.toString()}`, `daily_report_${date}.pdf`);
}

export function exportWeeklyCSV(startDate: string, endDate: string) {
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return downloadReportFile(`/reports/weekly/export/csv/?${query.toString()}`, `weekly_report_${startDate}_${endDate}.csv`);
}

export function exportWeeklyPDF(startDate: string, endDate: string) {
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return downloadReportFile(`/reports/weekly/export/pdf/?${query.toString()}`, `weekly_report_${startDate}_${endDate}.pdf`);
}
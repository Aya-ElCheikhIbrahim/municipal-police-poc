import { apiClient, tokenStore } from '../../shared/api/client';
import type {
  ActivityRow,
  Area,
  DailySummaryResponse,
  OfficerReportResponse,
  WeeklySummaryResponse,
  ReportFilterParams,
} from './types.ts';

// Helper to convert query params object into a URL search string
const buildQueryString = (params?: Record<string, any>): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

// Fetch the districts for the Area filter (GET /areas/ returns a plain array)
export const fetchAreas = async (): Promise<Area[]> => {
  const response = await apiClient.get<Area[]>('/areas/');
  return (response as any).data ?? response;
};

// Fetch daily summary metrics and officer list
export const fetchDailySummary = async (params?: ReportFilterParams): Promise<DailySummaryResponse> => {
  const cleanParams = {
    ...params,
    officer_id: params?.officer_id ?? (params?.officer && params.officer !== 'ALL' ? params.officer : undefined),
  };

  const query = buildQueryString(cleanParams);
  const response = await apiClient.get<DailySummaryResponse>(`/reports/daily/summary/${query}`);
  return (response as any).data ?? response;
};

// Fetch real-time snapshot feed
export const fetchActivityFeed = async (params?: ReportFilterParams): Promise<ActivityRow[]> => {
  const cleanParams = {
    ...params,
    officer_id: params?.officer_id ?? (params?.officer && params.officer !== 'ALL' ? params.officer : undefined),
  };

  const query = buildQueryString(cleanParams);
const response = await apiClient.get<ActivityRow[]>(`/reports/activity/${query}`);
  return (response as any).data ?? response;
};

// Fetch weekly or custom range summary
export const fetchWeeklySummary = async (params?: ReportFilterParams): Promise<WeeklySummaryResponse> => {
  const cleanParams = {
    ...params,
    officer_id: params?.officer_id ?? (params?.officer && params.officer !== 'ALL' ? params.officer : undefined),
  };

  const query = buildQueryString(cleanParams);
  const response = await apiClient.get<WeeklySummaryResponse>(`/reports/weekly/${query}`);
  return (response as any).data ?? response;
};

// Fetch single officer report details
export const fetchOfficerReport = async (params?: ReportFilterParams): Promise<OfficerReportResponse> => {
  const query = buildQueryString(params);
  const response = await apiClient.get<OfficerReportResponse>(`/reports/officer/${query}`);
  return (response as any).data ?? response;
};

// --- Report file exports (CSV / PDF) ---------------------------------------
// These endpoints are supervisor-only and return a file, so we can't use
// window.open (it can't send the JWT header) or apiClient.get (it JSON-parses
// the body). We fetch the blob with the auth token and trigger a download.
const API_BASE = import.meta.env.VITE_API_URL as string;

async function downloadReport(path: string, filename: string, params?: Record<string, any>) {
  const res = await fetch(`${API_BASE}${path}${buildQueryString(params)}`, {
    headers: { Authorization: `Bearer ${tokenStore.getAccess() ?? ''}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = window.URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Daily report is per-officer: the backend requires officer_id.
export const exportDailyCSV = (date: string, officerId?: number, status?: string) =>
  downloadReport('/reports/daily/export/csv/', `daily-${date}.csv`, { date, officer_id: officerId, status });

export const exportDailyPDF = (date: string, officerId?: number, status?: string) =>
  downloadReport('/reports/daily/export/pdf/', `daily-${date}.pdf`, { date, officer_id: officerId, status });

export const exportWeeklyCSV = (startDate: string, endDate: string) =>
  downloadReport('/reports/weekly/export/csv/', `weekly-${startDate}_${endDate}.csv`, { start_date: startDate, end_date: endDate });

export const exportWeeklyPDF = (startDate: string, endDate: string) =>
  downloadReport('/reports/weekly/export/pdf/', `weekly-${startDate}_${endDate}.pdf`, { start_date: startDate, end_date: endDate });
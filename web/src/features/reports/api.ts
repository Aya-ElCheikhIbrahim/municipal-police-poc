import { apiClient } from '../../shared/api/client';
import type {
  ActivityRow,
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

// Binary export downloader for CSV / PDF files
export const exportReportFile = async (endpoint: string, filename: string, params?: Record<string, any>) => {
  const query = buildQueryString(params);
  const response: any = await apiClient.get(`${endpoint}${query}`);
  const blobData = response.data ?? response;
  const url = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Export Daily Report as CSV
export const exportDailyCSV = (date: string, officerId?: number, status?: string) => {
  const query = buildQueryString({ date, officer_id: officerId, status });
  window.open(`/api/reports/daily/export-csv/${query}`, '_blank');
};

// Export Daily Report as PDF
export const exportDailyPDF = (date: string, officerId?: number, status?: string) => {
  const query = buildQueryString({ date, officer_id: officerId, status });
  window.open(`/api/reports/daily/export-pdf/${query}`, '_blank');
};

// Export Weekly Summary as CSV
export const exportWeeklyCSV = (startDate: string, endDate: string) => {
  const query = buildQueryString({ start_date: startDate, end_date: endDate });
  window.open(`/api/reports/weekly/export-csv/${query}`, '_blank');
};

// Export Weekly Summary as PDF
export const exportWeeklyPDF = (startDate: string, endDate: string) => {
  const query = buildQueryString({ start_date: startDate, end_date: endDate });
  window.open(`/api/reports/weekly/export-pdf/${query}`, '_blank');
};
function downloadBlob(response: any, filename: string) {
  const data = response?.data ?? response;
  const blob = new Blob([data], { type: data.type || 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
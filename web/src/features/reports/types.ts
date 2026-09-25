export type ReportSubTab = 'Daily activity' | 'Weekly summary' | 'Custom range';

// Filter state used across UI components
export interface FilterState {
  officer: string;
  reportType: string;
  priority: string;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
  fromTime: string;
  toTime: string;
}

export interface ReportFilterParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  officer?: string;
  officer_id?: number;
  location?: string;
  status?: string;
  from_time?: string;
  to_time?: string;
}

// ------------------------------------------------------------------
// Types matching Django Serializers (serializers.py)
// ------------------------------------------------------------------

export interface OfficerBrief {
  id: number;
  name: string;
  badge_number?: string;
}

// ActivityFeedView response
export interface ActivityRow {
  at: string;
  activity: string;
  activity_label: string;
  officer: OfficerBrief | null;
  area: string | null;
  area_id: number | null;
  details: string;
  mission_id: number | null;
  panic_id: number | null;
}

// DailySummaryView response
export interface DailySummaryTotals {
  officers_on_duty: number;
  hours_on_duty: number;
  distance_covered_m: number;
  missions_assigned: number;
  missions_completed: number;
  missions_cancelled: number;
  missions_in_progress: number;
  panic_events: number;
}

export interface OfficerArea {
  area_id: number | null;
  name: string | null;
  missions: number;
}

export interface DailySummaryOfficer {
  officer_id: number;
  officer_name: string;
  badge_number: string;
  shift_start: string | null;
  shift_end: string | null;
  still_on_duty: boolean;
  hours_on_duty: number;
  distance_covered_m: number;
  missions_assigned: number;
  missions_completed: number;
  missions_cancelled: number;
  missions_in_progress: number;
  panic_events: number;
  areas: OfficerArea[];
}

export interface DailySummaryResponse {
  date: string;
  totals: DailySummaryTotals;
  officers: DailySummaryOfficer[];
}

// WeeklySummaryView response
export interface TopOfficer {
  officer_id: number;
  officer_name: string;
  completed_missions: number;
}

export interface RangeTotals {
  officers: number;
  hours_on_duty: number;
  distance_covered_m: number;
  missions_assigned: number;
  missions_completed: number;
  missions_cancelled: number;
  panic_events: number;
}

export interface RangeOfficer {
  officer_id: number;
  officer_name: string;
  badge_number: string;
  hours_on_duty: number;
  distance_covered_m: number;
  missions_assigned: number;
  missions_completed: number;
  missions_cancelled: number;
  average_acknowledgement_seconds: number;
  average_completion_seconds: number;
  panic_events: number;
}

export interface WeeklySummaryResponse {
  start_date: string;
  end_date: string;
  missions_by_priority: Record<string, number>;
  missions_by_category: Record<string, number>;
  missions_by_status: Record<string, number>;
  average_acknowledgement_seconds: number;
  average_completion_seconds: number;
  top_officers: TopOfficer[];
  totals: RangeTotals;
  officers: RangeOfficer[];
}

// OfficerReportView response
export interface OfficerReportSummary {
  hours_on_duty: number;
  distance_covered_m: number;
  missions_assigned: number;
  missions_completed: number;
  missions_cancelled: number;
  missions_in_progress: number;
  panic_events: number;
}

export interface OfficerPerformance {
  average_acknowledgement_seconds: number;
  average_completion_seconds: number;
}

export interface OfficerMission {
  mission_id: number;
  title: string;
  status: string;
  priority: string;
  category: string;
  area: string | null;
  area_id: number | null;
  assigned_at: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface OfficerReportResponse {
  officer: OfficerBrief;
  start_date: string;
  end_date: string;
  current_status: string;
  current_mission: { mission_id: number; title: string; status: string } | null;
  summary: OfficerReportSummary;
  performance: OfficerPerformance;
  timeline: ActivityRow[];
  missions: OfficerMission[];
}
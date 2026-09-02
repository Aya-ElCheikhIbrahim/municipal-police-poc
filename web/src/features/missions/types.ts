import type { OfficerBrief } from '../officers/types';

export type MissionStatus =
  | 'new'
  | 'assigned'
  | 'acknowledged'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type MissionPriority = 'low' | 'medium' | 'high' | 'urgent';

export type MissionEventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'acknowledged'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'photo_added'
  | 'note_added'
  | 'ack_alert_sent';

export interface MissionEvent {
  id: number;
  event_type: MissionEventType;
  actor: OfficerBrief | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface MissionPhoto {
  id: number;
  client_uuid: string;
  image: string;
  captured_latitude: string | null;
  captured_longitude: string | null;
  captured_at: string | null;
  uploaded_at: string;
}

/** MissionListSerializer — the table row. No events or photos. */
export interface MissionListItem {
  id: number;
  title: string;
  priority: MissionPriority;
  status: MissionStatus;
  latitude: string;
  longitude: string;
  address: string;
  assigned_to: OfficerBrief | null;
  deadline: string | null;
  created_at: string;
  assigned_at: string | null;
  is_overdue: boolean;
  awaiting_acknowledgement: boolean;
}

export interface MissionDetail extends MissionListItem {
  description: string;
  created_by: OfficerBrief | null;
  acknowledged_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  started_latitude: string | null;
  started_longitude: string | null;
  completed_latitude: string | null;
  completed_longitude: string | null;
  notes: string;
  cancellation_reason: string;
  ack_alert_sent_at: string | null;
  events: MissionEvent[];
  photos: MissionPhoto[];
}

/** Body for POST /missions/. Creating and assigning is one call. */
export interface CreateMissionRequest {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  priority: MissionPriority;
  deadline?: string | null;
  /** Officer id, not a name. */
  assigned_to_id?: number | null;
}

/** Query params supported by GET /missions/. All filtering is server-side. */
export interface MissionFilters {
  status?: MissionStatus;
  priority?: MissionPriority;
  officer_id?: number;
  /** YYYY-MM-DD */
  date?: string;
  /** Only missions not yet completed or cancelled. */
  open?: boolean;
}

export const MISSION_STATUSES: MissionStatus[] = [
  'new',
  'assigned',
  'acknowledged',
  'in_progress',
  'completed',
  'cancelled',
];

export const MISSION_PRIORITIES: MissionPriority[] = ['low', 'medium', 'high', 'urgent'];

export function statusLabel(status: MissionStatus): string {
  return status === 'in_progress'
    ? 'In progress'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export function priorityLabel(priority: MissionPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function eventLabel(type: MissionEventType): string {
  const labels: Record<MissionEventType, string> = {
    created: 'Created',
    assigned: 'Assigned',
    reassigned: 'Reassigned',
    acknowledged: 'Acknowledged',
    started: 'Started',
    completed: 'Completed',
    cancelled: 'Cancelled',
    photo_added: 'Photo added',
    note_added: 'Note added',
    ack_alert_sent: 'Acknowledgement alert sent',
  };
  return labels[type];
}

/** Reassignment is only allowed before the officer acknowledges. */
export function canReassign(mission: MissionListItem): boolean {
  return mission.status === 'assigned';
}

export function canCancel(mission: MissionListItem): boolean {
  return mission.status !== 'completed' && mission.status !== 'cancelled';
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
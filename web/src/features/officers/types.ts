/**
 * The GET /api/v1/shifts/active/ contract.
 *
 * Source: backend/shifts/serializers.py (ActiveOfficerSerializer) and
 * backend/shifts/views.py (ActiveShiftsView).
 *
 * "Officers on the map" means "officers with an active shift" — there is no
 * separate officers-with-positions endpoint. An ended shift simply drops out
 * of this list.
 */

/** Matches core.serializers.OfficerBriefSerializer. */
export interface OfficerBrief {
  id: number;
  full_name: string;
  badge_number: string;
}

export interface LocationPing {
  latitude: string;
  longitude: string;
  accuracy_m: number | null;
  battery_level: number | null;
  network_type: string;
  recorded_at: string;
  received_at: string;
  is_offline_sync: boolean;
}

/**
 * The backend currently hardcodes "available" for every
 * officer, see the comment in ActiveShiftsView. The shape is agreed, so the
 * map will show real statuses once that join lands, with no frontend change.
 */
export type OfficerStatus = 'available' | 'on_mission' | 'panic';

export interface ActiveOfficer {
  officer: OfficerBrief;
  status: OfficerStatus;
  shift_started_at: string;
  shift_duration_seconds: number;
  distance_covered_m: number;
  /** Null when the officer has started a shift but sent no GPS fix yet. */
  latest_ping: LocationPing | null;
  current_mission: Record<string, unknown> | null;
}

export function pingToCoords(ping: LocationPing | null): [number, number] | null {
  if (!ping) return null;
  const lat = Number(ping.latitude);
  const lng = Number(ping.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lat, lng];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** 4820 -> "4.8 km" */
export function formatDistance(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

export function statusLabel(status: OfficerStatus): string {
  if (status === 'on_mission') return 'On mission';
  if (status === 'panic') return 'Panic';
  return 'Available';
}
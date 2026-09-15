/**
 * The GET /api/v1/panic/active/ contract.
 *
 * Source: backend/panic/serializers.py (ActivePanicSerializer) and
 * backend/panic/views.py (ActivePanicView) — §4.6, the red pulsing marker.
 *
 * Deliberately narrow: name, badge, and where they are. The outcome columns
 * (resolved_by, notes, ...) only exist once an alert is no longer active, so
 * they are never sent here — see panic/serializers.py for why.
 */

export interface PanicOfficerBrief {
  id: number;
  full_name: string;
  badge_number: string;
}

export interface PanicAlert {
  id: number;
  officer: PanicOfficerBrief;
  shift: number;
  latitude: string;
  longitude: string;
  accuracy_m: number | null;
  battery_level: number | null;
  triggered_at: string;
}

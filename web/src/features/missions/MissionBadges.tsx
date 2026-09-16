import { statusLabel } from './types';
import type { MissionPriority, MissionStatus } from './types';

const PRIORITY_STYLES: Record<MissionPriority, string> = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

export function PriorityBadge({ priority }: { priority: MissionPriority }) {
  return (
    <span className={`px-3 py-1.5 rounded text-base font-bold uppercase ${PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  );
}

// Colour follows the real status: amber waiting, blue working, green done, red cancelled.
const STATUS_STYLES: Record<MissionStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  assigned: 'bg-amber-100 text-amber-800',
  acknowledged: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  paused: 'bg-violet-100 text-violet-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-700',
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span className={`px-3 py-1.5 rounded-full text-base font-semibold ${STATUS_STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
}
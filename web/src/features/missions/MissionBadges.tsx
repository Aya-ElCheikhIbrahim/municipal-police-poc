import { priorityLabel, statusLabel } from './types';
import type { MissionPriority, MissionStatus } from './types';

const PRIORITY_STYLES: Record<MissionPriority, string> = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

export function PriorityBadge({ priority }: { priority: MissionPriority }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_STYLES[priority]}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}

const STATUS_STYLES: Record<MissionStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  acknowledged: 'bg-sky-50 text-sky-700',
  in_progress: 'bg-blue-50 text-[#2E5496]',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700 font-bold',
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
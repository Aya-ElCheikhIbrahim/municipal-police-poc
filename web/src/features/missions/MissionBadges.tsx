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

interface StatusBadgeProps {
  status: MissionStatus;
  createdAt?: string;
}

export function StatusBadge({ status, createdAt }: StatusBadgeProps) {
  let label = status as string;
  let style = 'bg-slate-100 text-slate-700';

  if (createdAt) {
    let hour = -1;

    // Handle standard time strings like "02:10 PM" or "14:10"
    const timeMatch = createdAt.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      let parsedHour = parseInt(timeMatch[1], 10);
      const modifier = timeMatch[3]?.toUpperCase();

      if (modifier === 'PM' && parsedHour < 12) parsedHour += 12;
      if (modifier === 'AM' && parsedHour === 12) parsedHour = 0;
      hour = parsedHour;
    } else {
      // Handle standard ISO dates
      const parsedDate = new Date(createdAt);
      if (!isNaN(parsedDate.getTime())) {
        hour = parsedDate.getHours();
      }
    }

    if (hour !== -1) {
      if (hour < 14) {
        label = 'Ongoing';
        style = 'bg-amber-100 text-amber-800 font-semibold';
      } else {
        label = 'Finished';
        style = 'bg-emerald-100 text-emerald-800 font-semibold';
      }
    }
  }

  return (
    <span className={`px-3 py-1.5 rounded-full text-base ${style}`}>
      {label}
    </span>
  );
}
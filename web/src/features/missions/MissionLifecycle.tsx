import { eventLabel, formatTime } from './types';
import type { MissionEvent } from './types';

export function MissionLifecycle({ events }: { events: MissionEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-slate-400">No activity recorded yet.</p>
    );
  }

  return (
    <div className="relative pl-6 space-y-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        const isTerminal =
          event.event_type === 'completed' || event.event_type === 'cancelled';

        return (
          <div key={event.id} className="relative flex items-start gap-3">
            <div
              className={`absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                isTerminal
                  ? event.event_type === 'cancelled'
                    ? 'bg-rose-600'
                    : 'bg-[#2E7D32]'
                  : isLatest
                    ? 'bg-[#1F3864]'
                    : 'bg-[#2E7D32]'
              }`}
            ></div>

            <div className="text-xs">
              <div className="font-bold text-slate-900 leading-tight">
                {eventLabel(event.event_type)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                <span className="font-medium text-slate-600">
                  {formatTime(event.created_at)}
                </span>
                {event.actor && <span> · {event.actor.full_name}</span>}
              </div>
              <EventDetail event={event} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventDetail({ event }: { event: MissionEvent }) {
  const metadata = event.metadata ?? {};

  const text =
    typeof metadata.text === 'string'
      ? metadata.text
      : typeof metadata.reason === 'string'
        ? metadata.reason
        : null;

  if (!text) return null;

  return <p className="text-[11px] text-slate-600 mt-1 italic">{text}</p>;
}
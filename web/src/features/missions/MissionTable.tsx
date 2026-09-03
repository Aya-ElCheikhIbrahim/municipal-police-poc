import { PriorityBadge, StatusBadge } from './MissionBadges';
import { formatTime } from './types';
import type { MissionListItem } from './types';

interface MissionTableProps {
  missions: MissionListItem[];
  isLoading: boolean;
  onSelect: (missionId: number) => void;
  onClearFilters: () => void;
  onCreate: () => void;
}

export function MissionTable({
  missions,
  isLoading,
  onSelect,
  onClearFilters,
  onCreate,
}: MissionTableProps) {
  if (isLoading) return <LoadingTable />;

  if (missions.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-16 px-4">
        <div className="text-center max-w-md mx-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            No missions match these filters
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Try clearing the filters, or create a new mission.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onClearFilters}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Clear filters
            </button>
            <button
              onClick={onCreate}
              className="px-4 py-2 bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
            >
              New mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
            <th className="p-3">Title</th>
            <th className="p-3">Priority</th>
            <th className="p-3">Status</th>
            <th className="p-3">Assigned To</th>
            <th className="p-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {missions.map((mission) => (
            <tr
              key={mission.id}
              onClick={() => onSelect(mission.id)}
              className="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="p-3">
                <div className="font-semibold text-slate-900">{mission.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {mission.address && (
                    <span className="text-[11px] text-slate-400">{mission.address}</span>
                  )}
                  {mission.is_overdue && (
                    <span className="text-[10px] font-bold text-rose-600 uppercase">
                      Overdue
                    </span>
                  )}
                  {mission.awaiting_acknowledgement && (
                    <span className="text-[10px] font-bold text-amber-600 uppercase">
                      No response
                    </span>
                  )}
                </div>
              </td>
              <td className="p-3">
                <PriorityBadge priority={mission.priority} />
              </td>
              <td className="p-3">
                <StatusBadge status={mission.status} />
              </td>
              <td className="p-3 text-slate-700">
                {mission.assigned_to ? (
                  <>
                    {mission.assigned_to.full_name}
                    <span className="text-slate-400">
                      {' '}
                      · {mission.assigned_to.badge_number}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </td>
              <td className="p-3 text-slate-400">{formatTime(mission.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
            <th className="p-3">Title</th>
            <th className="p-3">Priority</th>
            <th className="p-3">Status</th>
            <th className="p-3">Assigned To</th>
            <th className="p-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[1, 2, 3].map((row) => (
            <tr key={row} className="animate-pulse">
              <td className="p-3">
                <div className="h-2.5 bg-slate-200 rounded-full w-3/4"></div>
                <div className="h-2.5 bg-slate-200 rounded-full w-1/2 mt-1.5"></div>
              </td>
              <td className="p-3">
                <div className="h-2.5 bg-slate-200 rounded-full w-12"></div>
              </td>
              <td className="p-3">
                <div className="h-2.5 bg-slate-200 rounded-full w-16"></div>
              </td>
              <td className="p-3">
                <div className="h-2.5 bg-slate-200 rounded-full w-44"></div>
              </td>
              <td className="p-3">
                <div className="h-2.5 bg-slate-200 rounded-full w-12"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
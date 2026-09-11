import { PriorityBadge, StatusBadge } from './MissionBadges';
import { formatTime, formatMissionDuration } from './types';
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
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            No missions match these filters
          </h3>
          <p className="text-base sm:text-lg text-slate-500 mb-6 leading-relaxed">
            Try clearing the filters, or create a new mission.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onClearFilters}
              className="px-5 sm:px-6 py-2.5 sm:py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-base sm:text-lg font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Clear filters
            </button>
            <button
              onClick={onCreate}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-[#1F3864] hover:bg-[#182c50] text-white text-base sm:text-lg font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
            >
              New mission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {missions.map((mission) => (
          <div
            key={mission.id}
            onClick={() => onSelect(mission.id)}
            className="border border-slate-200 rounded-lg p-4 space-y-2 cursor-pointer hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-slate-900 text-lg">{mission.title}</div>
              <PriorityBadge priority={mission.priority} />
            </div>
            {mission.address && (
              <div className="text-sm text-slate-400">{mission.address}</div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <StatusBadge status={mission.status} />
              <span className="text-sm text-slate-400">{formatTime(mission.created_at)}</span>
            </div>
            {mission.duration_seconds !== null && (
              <div className="text-sm text-slate-500">
                {formatMissionDuration(mission.duration_seconds)} on mission
              </div>
            )}
            <div className="text-sm text-slate-600 pt-1 border-t border-slate-100 mt-2">
              {mission.assigned_to ? (
                <>
                  {mission.assigned_to.full_name}
                  <span className="text-slate-400"> · {mission.assigned_to.badge_number}</span>
                </>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </div>
            {(mission.is_overdue || mission.awaiting_acknowledgement) && (
              <div className="flex gap-2 pt-1">
                {mission.is_overdue && (
                  <span className="text-xs font-bold text-rose-600 uppercase">Overdue</span>
                )}
                {mission.awaiting_acknowledgement && (
                  <span className="text-xs font-bold text-amber-600 uppercase">No response</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block border border-slate-200 rounded-md overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xl border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-lg border-b border-slate-200">
              <th className="p-7">Title</th>
              <th className="p-7">Priority</th>
              <th className="p-7">Status</th>
              <th className="p-7">Duration</th>
              <th className="p-7">Assigned To</th>
              <th className="p-7">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {missions.map((mission) => (
              <tr
                key={mission.id}
                onClick={() => onSelect(mission.id)}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <td className="p-7">
                  <div className="font-semibold text-slate-900 text-xl">{mission.title}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {mission.address && (
                      <span className="text-base text-slate-400">{mission.address}</span>
                    )}
                    {mission.is_overdue && (
                      <span className="text-base font-bold text-rose-600 uppercase">
                        Overdue
                      </span>
                    )}
                    {mission.awaiting_acknowledgement && (
                      <span className="text-base font-bold text-amber-600 uppercase">
                        No response
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-7">
                  <PriorityBadge priority={mission.priority} />
                </td>
                <td className="p-7">
                  <StatusBadge status={mission.status} />
                </td>
                <td className="p-7 text-slate-600">
                  {formatMissionDuration(mission.duration_seconds)}
                </td>
                <td className="p-7 text-slate-700">
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
                <td className="p-7 text-slate-400">{formatTime(mission.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LoadingTable() {
  return (
    <div className="hidden md:block border border-slate-200 rounded-md overflow-hidden">
      <table className="w-full text-left text-xl border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-400 font-semibold uppercase tracking-wider text-lg border-b border-slate-200">
            <th className="p-7">Title</th>
            <th className="p-7">Priority</th>
            <th className="p-7">Status</th>
            <th className="p-7">Duration</th>
            <th className="p-7">Assigned To</th>
            <th className="p-7">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[1, 2, 3].map((row) => (
            <tr key={row} className="animate-pulse">
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded-full w-1/2 mt-2"></div>
              </td>
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-16"></div>
              </td>
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-24"></div>
              </td>
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-16"></div>
              </td>
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-52"></div>
              </td>
              <td className="p-7">
                <div className="h-4 bg-slate-200 rounded-full w-16"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
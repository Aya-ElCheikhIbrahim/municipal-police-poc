import { useState } from 'react';
import { useMissionDetail } from './useMissionDetail';
import { MissionLifecycle } from './MissionLifecycle';
import { PriorityBadge, StatusBadge } from './MissionBadges';
import { canCancel, canReassign } from './types';
import { ApiError } from '../../shared/api/client';
import type { ActiveOfficer } from '../officers/types';
import { missionsApi } from './api';

interface MissionDetailPageProps {
  missionId: number;
  officers: ActiveOfficer[];
  onBack: () => void;
  /** Called after a change so the list behind refreshes too. */
  onChanged: () => void;
}

export function MissionDetailPage({
  missionId,
  officers,
  onBack,
  onChanged,
}: MissionDetailPageProps) {
  const { mission, isLoading, error, refresh } = useMissionDetail(missionId);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    setIsBusy(true);
    try {
      await action();
      await refresh();
      onChanged();
      setIsCancelling(false);
      setIsReassigning(false);
      setCancelReason('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-white p-8">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="flex-1 bg-white p-8">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
        >
          ← Back to all missions
        </button>
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 mt-4">
          {error ?? 'Mission not found.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex w-full">
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
        >
          ← Back to all missions
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{mission.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {mission.address || 'No address given'}
              {mission.assigned_to
                ? ` · ${mission.assigned_to.full_name}, badge ${mission.assigned_to.badge_number}`
                : ' · Unassigned'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={mission.priority} />
            <StatusBadge status={mission.status} />
          </div>
        </div>

        {mission.description && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600">Description</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mission.description}
            </p>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-slate-600 mb-3">
            Photo evidence · {mission.photos.length}
          </div>
          {mission.photos.length === 0 ? (
            <p className="text-xs text-slate-400">
              No photos yet. Officers attach these from the mobile app.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {mission.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.image}
                  target="_blank"
                  rel="noreferrer"
                  className="h-36 bg-slate-100/80 rounded-lg border border-slate-200/60 overflow-hidden block"
                >
                  <img
                    src={photo.image}
                    alt="Mission evidence"
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {mission.notes && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-semibold text-slate-600">Officer notes</div>
            <p className="text-xs text-slate-600 leading-relaxed">{mission.notes}</p>
          </div>
        )}

        {mission.cancellation_reason && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-semibold text-rose-700">Cancellation reason</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mission.cancellation_reason}
            </p>
          </div>
        )}

        {actionError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {actionError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          {canReassign(mission) && (
            <button
              onClick={() => setIsReassigning(!isReassigning)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Reassign
            </button>
          )}

          {canCancel(mission) && (
            <button
              onClick={() => setIsCancelling(!isCancelling)}
              className="bg-[#C62828] hover:bg-rose-800 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer"
            >
              Cancel mission
            </button>
          )}
        </div>

        {isReassigning && (
          <div className="border border-slate-200 rounded-md p-4 space-y-3 max-w-md">
            <label className="block text-xs font-semibold text-slate-600">
              Reassign to
            </label>
            {officers.length === 0 ? (
              <p className="text-xs text-slate-500">No officers are on duty.</p>
            ) : (
              <div className="space-y-2">
                {officers.map((entry) => (
                  <button
                    key={entry.officer.id}
                    disabled={isBusy}
                    onClick={() => run(() => missionsApi.assign(mission.id, entry.officer.id))

                                        }
                    className="w-full text-left px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    {entry.officer.full_name}
                    <span className="text-slate-400">
                      {' '}
                      · Badge {entry.officer.badge_number}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isCancelling && (
          <div className="border border-rose-200 rounded-md p-4 space-y-3 max-w-md">
            <label className="block text-xs font-semibold text-slate-600">
              Reason for cancelling
            </label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Duplicate of mission #12"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={isBusy || !cancelReason.trim()}
            onClick={() => run(() => missionsApi.cancel(mission.id, cancelReason.trim()))}
                className="bg-[#C62828] hover:bg-rose-800 disabled:bg-slate-300 text-white text-xs font-semibold px-4 py-2 rounded-md cursor-pointer"
              >
                {isBusy ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
              <button
                onClick={() => setIsCancelling(false)}
                className="text-xs text-slate-600 px-3 py-2 cursor-pointer"
              >
                Keep mission
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="w-72 bg-slate-50/60 border-l border-slate-200 p-6 flex flex-col">
        <h3 className="text-xs font-semibold text-slate-500 mb-6 uppercase tracking-wider">
          Lifecycle
        </h3>
        <div className="flex-1">
          <MissionLifecycle events={mission.events} />
        </div>
      </aside>
    </div>
  );
}
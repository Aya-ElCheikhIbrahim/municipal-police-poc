import { useState } from 'react';
import { useMissionDetail } from './useMissionDetail';
import { MissionLifecycle } from './MissionLifecycle';
import { PriorityBadge, StatusBadge } from './MissionBadges';
import { canCancel, canReassign, formatMissionDuration } from './types';
import { ApiError } from '../../shared/api/client';
import type { ActiveOfficer } from '../officers/types';
import { missionsApi } from './api';
import { useLanguage } from '../../i18n/languagecontext';
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
  const { translations: t } = useLanguage();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignIds, setReassignIds] = useState<number[]>([]);
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
      setActionError(err instanceof ApiError ? err.message : t.missionDetail.actionFailed);
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
          {t.missionDetail.onBack}
        </button>
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 mt-4">
          {error ?? t.missionDetail.notFound}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex w-full min-h-0">
            <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6 min-h-0">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
        >
           {t.missionDetail.onBack}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{mission.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {mission.address || t.missionDetail.noAddress}
              {mission.assigned_to.length > 0
                ? ` · ${mission.assigned_to
                    .map((officer) => `${officer.full_name}, ${t.missionDetail.badge} ${officer.badge_number}`)
                    .join('; ')}`
                : ` · ${t.missionDetail.unassigned}`}
              {mission.duration_seconds !== null &&
                ` · ${formatMissionDuration(mission.duration_seconds)} ${t.missionDetail.onMission}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={mission.priority} />
            <StatusBadge status={mission.status} />
          </div>
        </div>

        {mission.description && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600">{t.missionDetail.description}</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mission.description}
            </p>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-slate-600 mb-3">
            {t.missionDetail.photoEvidence} · {mission.photos.length}
          </div>
          {mission.photos.length === 0 ? (
            <p className="text-xs text-slate-400">
              {t.missionDetail.noPhotos}
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
                    alt={t.missionDetail.evidenceAlt}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {mission.notes && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-semibold text-slate-600">{t.missionDetail.officerNotes}</div>
            <p className="text-xs text-slate-600 leading-relaxed">{mission.notes}</p>
          </div>
        )}

        {mission.cancellation_reason && (
          <div className="space-y-1.5 pt-2">
            <div className="text-xs font-semibold text-rose-700">{t.missionDetail.cancellationReason}</div>
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
              onClick={() => {
                setReassignIds(mission.assigned_to.map((officer) => officer.id));
                setIsReassigning(!isReassigning);
              }}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-4 py-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t.missionDetail.reassign}
            </button>
          )}

          {canCancel(mission) && (
            <button
              onClick={() => setIsCancelling(!isCancelling)}
              className="bg-[#C62828] hover:bg-rose-800 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer"
            >
              {t.missionDetail.cancelMission}
            </button>
          )}
        </div>

                {isReassigning && (
          <div className="border border-slate-200 rounded-md p-4 space-y-3 max-w-md flex flex-col min-h-0">
            <label className="block text-xs font-semibold text-slate-600">
              {t.missionDetail.assignTo}
            </label>
            {officers.length === 0 ? (
              <p className="text-xs text-slate-500">{t.missionDetail.noOfficersOnDuty}</p>
            ) : (
              <div className="flex flex-col gap-3 min-h-0">
                {/* Only the names scroll; the page and the Save button stay put. */}
                <div className="flex-1 min-h-24 max-h-48 overflow-y-auto overscroll-contain border border-slate-200 rounded-md divide-y divide-slate-100 p-1 bg-white">
                {officers.map((entry) => {
                  const id = entry.officer.id;
                  const checked = reassignIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50 cursor-pointer rounded-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isBusy}
                        onChange={() =>
                          setReassignIds((prev) =>
                            checked ? prev.filter((item) => item !== id) : [...prev, id]
                          )
                        }
                      />
                      {entry.officer.full_name}
                      <span className="text-slate-400">· {t.missionDetail.badge} {entry.officer.badge_number}</span>
                    </label>
                  );
                })}
                </div>
                <button
                  disabled={isBusy || reassignIds.length === 0}
                  onClick={() => run(() => missionsApi.assign(mission.id, reassignIds))}
                  className="shrink-0 self-start bg-[#1F3864] hover:bg-[#2E5496] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer"
                >
                  {t.missionDetail.saveOfficers}
                </button>
              </div>
            )}
          </div>
        )}

        {isCancelling && (
          <div className="border border-rose-200 rounded-md p-4 space-y-3 max-w-md">
            <label className="block text-xs font-semibold text-slate-600">
              {t.missionDetail.reasonForCancelling}
            </label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              	placeholder={t.missionDetail.cancelPlaceholder}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={isBusy || !cancelReason.trim()}
            onClick={() => run(() => missionsApi.cancel(mission.id, cancelReason.trim()))}
                className="bg-[#C62828] hover:bg-rose-800 disabled:bg-slate-300 text-white text-xs font-semibold px-4 py-2 rounded-md cursor-pointer"
              >
                {isBusy ? t.missionDetail.cancelling : t.missionDetail.confirmCancellation}
              </button>
              <button
                onClick={() => setIsCancelling(false)}
                className="text-xs text-slate-600 px-3 py-2 cursor-pointer"
              >
                {t.missionDetail.keepMission}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="w-72 bg-slate-50/60 border-l border-slate-200 p-6 flex flex-col overflow-y-auto">
              <h3 className="text-xs font-semibold text-slate-500 mb-6 uppercase tracking-wider">
          {t.missionDetail.lifecycle}
        </h3>
        <div className="flex-1">
          <MissionLifecycle events={mission.events} />
        </div>
      </aside>
    </div>
  );
}
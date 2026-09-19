import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { missionsApi } from './api';
import type { MissionDetail } from './types';

// The dispatcher watches the lifecycle happen here, so refresh faster than the list.
const POLL_INTERVAL_MS = 5_000;

export function useMissionDetail(missionId: number | null) {
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (missionId === null) {
        setMission(null);
        return;
      }
      // Background polls stay silent so the page does not flash its skeleton.
      if (!options?.silent) setIsLoading(true);
      setError(null);
      try {
        setMission(await missionsApi.detail(missionId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load this mission.');
      } finally {
        if (!options?.silent) setIsLoading(false);
      }
    },
    [missionId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (missionId === null) return;

    const timer = setInterval(() => refresh({ silent: true }), POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [missionId, refresh]);

  return { mission, isLoading, error, refresh };
}
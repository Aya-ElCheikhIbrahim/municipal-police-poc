import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { missionsApi } from './api';
import type { MissionDetail } from './types';

export function useMissionDetail(missionId: number | null) {
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (missionId === null) {
      setMission(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setMission(await missionsApi.detail(missionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this mission.');
    } finally {
      setIsLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { mission, isLoading, error, refresh };
}
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { missionsApi } from './api';
import type { MissionListItem, CreateMissionRequest, MissionFilters } from './types';

const POLL_INTERVAL_MS = 10_000;

interface UseMissionsResult {
  missions: MissionListItem[];
  isLoading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  createMission: (payload: CreateMissionRequest) => Promise<MissionListItem>;
  cancelMission: (id: number, reason: string) => Promise<void>;
  assignMission: (id: number, officerIds: number[]) => Promise<void>;
}

export function useMissions(filters: MissionFilters = {}): UseMissionsResult {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      // Background polls stay silent so the table does not flash its skeleton.
      if (!options?.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await missionsApi.list(JSON.parse(filterKey) as MissionFilters);
        setMissions(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load missions.');
      } finally {
        if (!options?.silent) setIsLoading(false);
      }
    },
    [filterKey],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Officers change mission status from their phones; keep the list current.
  useEffect(() => {
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
  }, [refresh]);

  async function createMission(payload: CreateMissionRequest) {
    const created = await missionsApi.create(payload);
    await refresh();
    return created;
  }

  async function cancelMission(id: number, reason: string) {
    await missionsApi.cancel(id, reason);
    await refresh();
  }

  async function assignMission(id: number, officerIds: number[]) {
    await missionsApi.assign(id, officerIds);
    await refresh();
  }

  return { missions, isLoading, error, refresh, createMission, cancelMission, assignMission };
}
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { missionsApi } from './api';
import type { MissionListItem, CreateMissionRequest, MissionFilters } from './types';

interface UseMissionsResult {
  missions: MissionListItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createMission: (payload: CreateMissionRequest) => Promise<MissionListItem>;
  cancelMission: (id: number, reason: string) => Promise<void>;
  assignMission: (id: number, officerId: number) => Promise<void>;
}

export function useMissions(filters: MissionFilters = {}): UseMissionsResult {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await missionsApi.list(JSON.parse(filterKey) as MissionFilters);
      setMissions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load missions.');
    } finally {
      setIsLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    refresh();
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

  async function assignMission(id: number, officerId: number) {
    await missionsApi.assign(id, officerId);
    await refresh();
  }

  return { missions, isLoading, error, refresh, createMission, cancelMission, assignMission };
}
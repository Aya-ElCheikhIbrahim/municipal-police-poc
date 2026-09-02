import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { officersApi } from './api';
import type { ActiveOfficer } from './types';


const POLL_INTERVAL_MS = 15_000;

interface UseActiveOfficersResult {
  officers: ActiveOfficer[];
  isLoading: boolean;
  error: string | null;
  secondsSinceUpdate: number;
  refresh: () => Promise<void>;
}

export function useActiveOfficers(enabled = true): UseActiveOfficersResult {
  const [officers, setOfficers] = useState<ActiveOfficer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  const lastSuccessRef = useRef<number>(Date.now());

  const refresh = useCallback(async () => {
    try {
      const data = await officersApi.listActive();
      setOfficers(data);
      setError(null);
      lastSuccessRef.current = Date.now();
    } catch (err) {
      // Keep showing the last known positions rather than blanking the map.
      // A dispatcher with stale markers is better off than one with none.
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  // Tick the staleness counter once a second.
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastSuccessRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled]);

  return { officers, isLoading, error, secondsSinceUpdate, refresh };
}
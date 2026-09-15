import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { panicApi } from './api';
import type { PanicAlert } from './types';

// Panic is urgent — poll far more often than the 15s officer feed.
const POLL_INTERVAL_MS = 5_000;

interface UsePanicAlertsResult {
  alerts: PanicAlert[];
  error: string | null;
  resolve: (id: number, notes?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePanicAlerts(enabled = true): UsePanicAlertsResult {
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await panicApi.listActive();
      setAlerts(data);
      setError(null);
    } catch (err) {
      // Keep showing the last known alerts rather than blanking the banner —
      // a dispatcher with a stale alert is safer than one who sees none.
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!enabled) return;

    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  const resolve = useCallback(
    async (id: number, notes?: string) => {
      // Optimistic: a dispatcher expects the banner to clear the moment they
      // act on it, not up to 5s later on the next poll. If the request turns
      // out to have failed, `refresh` below brings the alert straight back.
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      try {
        await panicApi.resolve(id, notes);
      } finally {
        refresh();
      }
    },
    [refresh],
  );

  return { alerts, error, resolve, refresh };
}

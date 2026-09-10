import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { officersApi } from '../officers/api';
import { pingToCoords } from '../officers/types';
import type { OfficerTrail } from '../officers/types';

interface UseOfficerTrailOptions {
  mapRef: React.RefObject<L.Map | null>;
  /** The officer whose path to draw. Null clears it. */
  officerId: number | null;
  /** YYYY-MM-DD. Omit for today. */
  date?: string;
}

/**
 * section 4.6 - "Click officer -> drawer shows ... day's location trail."
 *
 * Fetched on selection rather than polled: the trail is a whole day of points
 * and only grows by one point per ping interval, so pulling it on every
 * 15-second map refresh would move a lot of rows for very little new data.
 */
export function useOfficerTrail({ mapRef, officerId, date }: UseOfficerTrailOptions) {
  const [trail, setTrail] = useState<OfficerTrail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (officerId === null) {
      setTrail(null);
      return;
    }

    // Guards against a slow response for a previously selected officer
    // landing after the dispatcher has already clicked someone else.
    let cancelled = false;
    setIsLoading(true);

    officersApi
      .getTrail(officerId, date)
      .then((data) => {
        if (!cancelled) setTrail(data);
      })
      .catch(() => {
        // A failed trail must not blank the drawer; the shift stats above it
        // came from a different request and are still good.
        if (!cancelled) setTrail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [officerId, date]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coords = (trail?.points ?? [])
      .map(pingToCoords)
      .filter((c): c is [number, number] => c !== null);

    // One point is a position, not a path - the marker already shows it.
    if (coords.length < 2) return;

    const line = L.polyline(coords, {
      color: '#2E5496',
      weight: 4,
      opacity: 0.75,
    }).addTo(map);
    lineRef.current = line;

    return () => {
      map.removeLayer(line);
      lineRef.current = null;
    };
  }, [mapRef, trail]);

  /** Fit the map to the whole path. Called from a button, not automatically. */
  const zoomToTrail = () => {
    const map = mapRef.current;
    if (!map || !lineRef.current) return;
    map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
  };

  return { trail, isLoading, zoomToTrail };
}
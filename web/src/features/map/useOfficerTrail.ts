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
  const [fetchedTrail, setFetchedTrail] = useState<OfficerTrail | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  // One key per request, so a trail is only shown once its own request has
  // landed - never the previous officer's path while the new one loads.
  const requestKey = officerId === null ? null : `${officerId}:${date ?? ''}`;

  // Both derived rather than set from inside the effect below: setting state
  // in an effect body costs an extra render pass and React's lint rule flags
  // it. The effect only talks to the API.
  const trail = requestKey !== null && loadedKey === requestKey ? fetchedTrail : null;
  const isLoading = requestKey !== null && loadedKey !== requestKey;

  useEffect(() => {
    if (officerId === null || requestKey === null) return;

    // Guards against a slow response for a previously selected officer
    // landing after the dispatcher has already clicked someone else.
    let cancelled = false;

    officersApi
      .getTrail(officerId, date)
      .then((data) => {
        if (cancelled) return;
        setFetchedTrail(data);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        // A failed trail must not blank the drawer; the shift stats above it
        // came from a different request and are still good.
        if (cancelled) return;
        setFetchedTrail(null);
        setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [officerId, date, requestKey]);

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
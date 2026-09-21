import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { apiClient } from '../../shared/api/client';
import { displayOfficerStatus, pingToCoords } from '../officers/types';
import type { ActiveOfficer } from '../officers/types';

/**
 * §4.7 — the backend alerts every officer on duty within
 * `panic_nearby_radius_m` of a panic. This draws that same radius on the map,
 * so a dispatcher can see at a glance who was called to help.
 */

/** Used until the server's value arrives, and if the request fails. */
const FALLBACK_RADIUS_M = 2000;

interface SystemSettings {
  panic_nearby_radius_m?: number;
}

interface UsePanicRadiusOptions {
  mapRef: React.RefObject<L.Map | null>;
  officers: ActiveOfficer[];
}

export function usePanicRadius({ mapRef, officers }: UsePanicRadiusOptions) {
  const [radiusM, setRadiusM] = useState<number>(FALLBACK_RADIUS_M);
  const circlesRef = useRef<Map<number, L.Circle>>(new Map());

  // The radius is a system setting a supervisor can change, so read it rather
  // than hard-coding 2 km twice. Read once: it changes about never, and the
  // map already polls enough.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<SystemSettings>('/settings/')
      .then((settings) => {
        if (!cancelled && settings.panic_nearby_radius_m) {
          setRadiusM(settings.panic_nearby_radius_m);
        }
      })
      .catch(() => {
        // Keep the fallback. A missing setting must not cost the dispatcher
        // the red circle on a live alert.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const circles = circlesRef.current;
    const panicking = new Set<number>();

    for (const entry of officers) {
      if (displayOfficerStatus(entry) !== 'panic') continue;

      const coords = pingToCoords(entry.latest_ping);
      if (!coords) continue;

      const id = entry.officer.id;
      panicking.add(id);

      const existing = circles.get(id);
      if (existing) {
        existing.setLatLng(coords);
        existing.setRadius(radiusM);
      } else {
        const circle = L.circle(coords, {
          radius: radiusM,
          color: '#e11d48',
          weight: 2,
          opacity: 0.85,
          fillColor: '#f43f5e',
          fillOpacity: 0.12,
          // Clicks belong to the markers underneath, not to the circle.
          interactive: false,
        }).addTo(map);
        circles.set(id, circle);
      }
    }

    // The alert was resolved or cancelled, or the shift ended.
    for (const [id, circle] of circles) {
      if (!panicking.has(id)) {
        map.removeLayer(circle);
        circles.delete(id);
      }
    }
  }, [mapRef, officers, radiusM]);

  // Leaflet destroys its own layers with the map, so this only clears the
  // lookup the next map would otherwise inherit.
  useEffect(() => {
    const circles = circlesRef.current;
    return () => {
      circles.clear();
    };
  }, []);

  return { radiusM };
}
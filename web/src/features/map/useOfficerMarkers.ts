import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { officerIcon } from './leafletIcons';
import { pingToCoords } from '../officers/types';
import type { ActiveOfficer } from '../officers/types';

interface UseOfficerMarkersOptions {
  mapRef: React.RefObject<L.Map | null>;
  officers: ActiveOfficer[];
  selectedOfficerId: number | null;
  onSelect: (officerId: number) => void;
  followSelected?: boolean;
}
export function useOfficerMarkers({
  mapRef,
  officers,
  selectedOfficerId,
  onSelect,
  followSelected = true,
}: UseOfficerMarkersOptions) {
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const seen = new Set<number>();

    for (const entry of officers) {
      const coords = pingToCoords(entry.latest_ping);
      if (!coords) continue;

      const id = entry.officer.id;
      seen.add(id);

      const icon = officerIcon(entry.status, id === selectedOfficerId);
      const existing = markers.get(id);

      if (existing) {
        existing.setLatLng(coords);
        existing.setIcon(icon);
      } else {
        const marker = L.marker(coords, { icon }).addTo(map);
        marker.on('click', () => onSelectRef.current(id));
        markers.set(id, marker);
      }
    }

    // Officers whose shift ended are no longer in the payload.
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markers.delete(id);
      }
    }
  }, [mapRef, officers, selectedOfficerId]);

  // Pan to the selected officer. Separate effect so a poll updating positions
  // does not yank the map back every 15 seconds.
  useEffect(() => {
    if (!followSelected || selectedOfficerId === null) return;

    const map = mapRef.current;
    const selected = officers.find((o) => o.officer.id === selectedOfficerId);
    if (!map || !selected) return;

    const coords = pingToCoords(selected.latest_ping);
    if (coords) map.panTo(coords, { animate: true });
  }, [selectedOfficerId, followSelected]);

  // Remove every marker when the map goes away.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.clear();
    };
  }, []);
}
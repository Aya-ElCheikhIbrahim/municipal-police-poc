import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { missionPinIcon } from './leafletIcons';

/** A single pin marking where a mission is, moved by clicking the map. */
export function useMissionPin({
  mapRef,
  coords,
}: {
  mapRef: React.RefObject<L.Map | null>;
  coords: [number, number];
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng(coords);
    } else {
      markerRef.current = L.marker(coords, { icon: missionPinIcon() }).addTo(map);
    }
  }, [mapRef, coords]);

  useEffect(() => {
    return () => {
      markerRef.current = null;
    };
  }, []);
}

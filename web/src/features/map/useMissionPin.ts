import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { missionPinIcon } from './leafletIcons';

/**
 * A single pin marking where a mission is, moved by clicking the map.
 *
 * Null coords means no location has been chosen yet and the map stays bare —
 * a pin sitting on the centre of Tripoli before anyone clicked reads as a
 * real mission location, which it is not.
 */
export function useMissionPin({
  mapRef,
  coords,
}: {
  mapRef: React.RefObject<L.Map | null>;
  coords: [number, number] | null;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!coords) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

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

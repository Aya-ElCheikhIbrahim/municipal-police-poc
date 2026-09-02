import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TRIPOLI_CENTRE } from './leafletIcons';

interface UseLeafletMapOptions {
  /** Create the map only when the container is actually visible. */
  enabled?: boolean;
  centre?: [number, number];
  zoom?: number;
  onClick?: (coords: [number, number]) => void;
}

export function useLeafletMap({
  enabled = true,
  centre = TRIPOLI_CENTRE,
  zoom = 13,
  onClick,
}: UseLeafletMapOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: centre,
        zoom,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        onClickRef.current?.([
          parseFloat(e.latlng.lat.toFixed(6)),
          parseFloat(e.latlng.lng.toFixed(6)),
        ]);
      });

      mapRef.current = map;
    }

    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 100);

    return () => clearTimeout(timer);
    
  }, [enabled]);

  return { containerRef, mapRef };
}
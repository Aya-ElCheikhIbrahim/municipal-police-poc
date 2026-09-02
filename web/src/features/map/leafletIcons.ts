import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { OfficerStatus } from '../officers/types';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** §4.6: available is green, on mission is blue, panic is red and pulses. */
const STATUS_COLOUR: Record<OfficerStatus, string> = {
  available: 'bg-[#2E7D32]',
  on_mission: 'bg-[#2E5496]',
  panic: 'bg-rose-600',
};

export function officerIcon(status: OfficerStatus, isSelected: boolean): L.DivIcon {
  const isPanic = status === 'panic';

  const html = `
    <div class="relative flex items-center justify-center">
      ${isPanic ? '<div class="absolute w-8 h-8 rounded-full bg-rose-500/50 animate-ping"></div>' : ''}
      <div class="w-5 h-5 rounded-full ${STATUS_COLOUR[status]} border-2 border-white shadow-md ${
        isSelected ? 'ring-4 ring-indigo-500/50 scale-125' : ''
      }"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function missionPinIcon(): L.DivIcon {
  return L.divIcon({
    html: `
      <div class="w-6 h-6 bg-rose-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
        📍
      </div>
    `,
    className: 'custom-pin-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export const TRIPOLI_CENTRE: [number, number] = [34.4367, 35.8497];
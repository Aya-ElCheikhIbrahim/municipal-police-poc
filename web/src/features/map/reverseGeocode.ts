/**
 * Turns a point on the map into something a supervisor can read.
 *
 * Nominatim is OpenStreetMap's own geocoder: free, no key, and the same
 * project already serving every tile on these maps. Its usage policy allows
 * one request per second, which one-request-per-click stays well inside, and
 * callers abort the previous lookup before starting the next one.
 *
 * Any failure — offline, rate limited, a point with no street — falls back to
 * the nearest neighbourhood in tripoliLocations, so the Address field is never
 * left empty after a click.
 */
import { nearestTripoliLocation } from '../../data/tripoliLocations';

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

/** Nominatim returns far more than this; these are the parts worth showing. */
interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
}

interface NominatimReply {
  display_name?: string;
  address?: NominatimAddress;
}

export interface ReverseGeocodeResult {
  address: string;
  /** 'osm' when Nominatim answered, 'offline' when the nearest area was used. */
  source: 'osm' | 'offline';
}

/**
 * Rejects only when `signal` aborts — every other error resolves to the
 * offline fallback, so callers need one catch for one case.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const url =
    `${ENDPOINT}?format=jsonv2&zoom=18&addressdetails=1` +
    `&lat=${latitude}&lon=${longitude}&accept-language=en`;

  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Nominatim replied ${response.status}`);

    const label = formatAddress((await response.json()) as NominatimReply);
    if (label) return { address: label, source: 'osm' };
  } catch (error) {
    // An abort is a newer click, not a failure: let the caller drop this one.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
  }

  return { address: nearestTripoliLocation(latitude, longitude), source: 'offline' };
}

/**
 * Street, then area, then town: "Sea Road, El Beddaoui, Tripoli".
 *
 * Nominatim names the same kind of place differently depending on how the
 * local mappers tagged it — around Tripoli the same field comes back as road,
 * residential or neighbourhood — hence the fallbacks on each line. Lines that
 * find nothing drop out, and the de-duplication covers the points where two
 * of them land on the same name.
 */
function formatAddress(reply: NominatimReply): string {
  const address = reply.address ?? {};

  const parts = [
    address.road ?? address.pedestrian ?? address.footway ?? address.residential,
    address.neighbourhood ?? address.suburb ?? address.quarter ?? address.city_district,
    address.city ?? address.town ?? address.village,
  ].filter((part): part is string => Boolean(part));

  return [...new Set(parts)].join(', ') || (reply.display_name ?? '').trim();
}

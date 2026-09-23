export const TRIPOLI_LOCATIONS = [
  'Abu Samra, Tripoli, Lebanon',
  'Bahsas, Tripoli, Lebanon',
  'Al Tall, Tripoli, Lebanon',
  'Al Qobbe, Tripoli, Lebanon',
  'Al Dam Wal Farez, Tripoli, Lebanon',
  'Al Maarad, Tripoli, Lebanon',
  'Jabal Mohsen, Tripoli, Lebanon',
  'Tabbaneh, Tripoli, Lebanon',
  'Zahrieh, Tripoli, Lebanon',
  'Azmi Street, Tripoli, Lebanon',
  'Old City, Tripoli, Lebanon',
  'Mina, Tripoli, Lebanon',
  'Mitein Street, Tripoli, Lebanon',
  'Central, Tripoli, Lebanon',
  'Corniche, Tripoli, Lebanon',
  'Metran Street, Tripoli, Lebanon',
  'Boulevard, Tripoli, Lebanon',
  'Haddadine, Tripoli, Lebanon',
  'Al Nini, Tripoli, Lebanon',
] as const;

export type TripoliLocation = (typeof TRIPOLI_LOCATIONS)[number];


export const LOCATION_ALIASES: Partial<Record<TripoliLocation, string[]>> = {
  'Abu Samra, Tripoli, Lebanon': [
    'abu samra',
    'abou samra',
    'abi samra',
    'abo samra',
  ],

  'Bahsas, Tripoli, Lebanon': [
    'bahsas',
    'bahssas',
    'bohssas',
    'bohsas',
    'al bahsas',
    'el bahsas',
  ],

  'Al Tall, Tripoli, Lebanon': [
    'tall',
    'tal',
    'tell',
    'tel',
    'al tall',
    'el tall',
    'al tell',
    'el tell',
  ],

  'Al Qobbe, Tripoli, Lebanon': [
    'qobbe',
    'qobbeh',
    'kobbe',
    'kobbeh',
    'qubbe',
    'qubbeh',
    'qibbeh',
    'ebbeh',
    'ebeh',
    'ebe',
    'ebbe',
  ],

  'Al Dam Wal Farez, Tripoli, Lebanon': [
    'dam w farez',
    'dam wal farez',
    'dam wel farez',
    'dam el farez',
    'dam farez',
    'dam w farz',
    'dam wel farz',
    'damm w farez',
  ],

  'Al Maarad, Tripoli, Lebanon': [
    'maarad',
    'maared',
    'al maarad',
    'el maarad',
    'al maared',
    'el maared',
  ],

  'Jabal Mohsen, Tripoli, Lebanon': [
    'jabal mohsen',
    'jabal mohsin',
    'jabal muhsin',
    'jabal mohssin',
  ],

  'Tabbaneh, Tripoli, Lebanon': [
    'tabbaneh',
    'tebbaneh',
    'tabbane',
    'tebbane',
    'bab el tabbaneh',
    'bab al tabbaneh',
    'bab el tebbeneh',
    'tebbene',
  ],

  'Zahrieh, Tripoli, Lebanon': [
    'zahrieh',
    'zahriyeh',
    'zahriyyeh',
    'zahriye',
    'zehriye',
  ],

  'Azmi Street, Tripoli, Lebanon': [
    'azmi',
    'azmi street',
    'azmi st',
    'azmy',
    'aazmi',
    'aazmi street',
  ],

  'Old City, Tripoli, Lebanon': [
    'old city',
    'old tripoli',
    'tripoli old city',
    'old souks',
    'old souk',
    'souk',
  ],

  'Mina, Tripoli, Lebanon': [
    'mina',
    'el mina',
    'al mina',
    'minaa',
    'el minaa',
    'al minaa',
  ],

  'Mitein Street, Tripoli, Lebanon': ['miten', 'mitein', 'miten street'],
};

export const MAX_LOCATION_SUGGESTIONS = 8;
export function searchTripoliLocations(query: string): string[] {
  const search = query.trim().toLowerCase();

  if (!search) return [];

  const matches = TRIPOLI_LOCATIONS.filter((location) => {
    const matchesName = location.toLowerCase().includes(search);
    const matchesAlias = LOCATION_ALIASES[location]?.some((alias) =>
      alias.includes(search),
    );
    return matchesName || matchesAlias;
  });

  return matches.slice(0, MAX_LOCATION_SUGGESTIONS);
}

/**
 * Rough centre of each neighbourhood above, used only to name a clicked point
 * when the online lookup cannot be reached. These were eyeballed on the map
 * and are accurate to a few hundred metres, which is all "which area is this"
 * needs — correct any that feel wrong by clicking the spot on the create
 * mission map and reading the coordinates in the bottom-left corner.
 */
export const LOCATION_COORDS: Record<TripoliLocation, [number, number]> = {
  'Abu Samra, Tripoli, Lebanon': [34.4262, 35.8452],
  'Bahsas, Tripoli, Lebanon': [34.4103, 35.8302],
  'Al Tall, Tripoli, Lebanon': [34.4363, 35.8436],
  'Al Qobbe, Tripoli, Lebanon': [34.4408, 35.859],
  'Al Dam Wal Farez, Tripoli, Lebanon': [34.433, 35.853],
  'Al Maarad, Tripoli, Lebanon': [34.4373, 35.845],
  'Jabal Mohsen, Tripoli, Lebanon': [34.447, 35.856],
  'Tabbaneh, Tripoli, Lebanon': [34.447, 35.85],
  'Zahrieh, Tripoli, Lebanon': [34.433, 35.848],
  'Azmi Street, Tripoli, Lebanon': [34.439, 35.842],
  'Old City, Tripoli, Lebanon': [34.4344, 35.848],
  'Mina, Tripoli, Lebanon': [34.45, 35.82],
  'Mitein Street, Tripoli, Lebanon': [34.44, 35.839],
  'Central, Tripoli, Lebanon': [34.4367, 35.8497],
  'Corniche, Tripoli, Lebanon': [34.446, 35.824],
  'Metran Street, Tripoli, Lebanon': [34.438, 35.84],
  'Boulevard, Tripoli, Lebanon': [34.434, 35.841],
  'Haddadine, Tripoli, Lebanon': [34.442, 35.85],
  'Al Nini, Tripoli, Lebanon': [34.44, 35.835],
};

/**
 * The name of the closest neighbourhood to a point.
 *
 * Flat-earth distance on purpose: over a city this size the error is metres,
 * and only the ranking matters here, never the number itself. Longitude is
 * scaled by cos(latitude) so a degree east counts for what it is worth at
 * Tripoli's latitude.
 */
export function nearestTripoliLocation(latitude: number, longitude: number): string {
  const scale = Math.cos((latitude * Math.PI) / 180);

  let closest: string = TRIPOLI_LOCATIONS[0];
  let smallest = Number.POSITIVE_INFINITY;

  for (const [name, [lat, lng]] of Object.entries(LOCATION_COORDS)) {
    const dLat = lat - latitude;
    const dLng = (lng - longitude) * scale;
    const distance = dLat * dLat + dLng * dLng;

    if (distance < smallest) {
      smallest = distance;
      closest = name;
    }
  }

  return closest;
}

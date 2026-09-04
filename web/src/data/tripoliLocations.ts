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
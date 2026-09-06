export type ReportSubTab = 'Daily activity' | 'Weekly summary' | 'Date range report';
export type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';

export type MissionCategoryFilter = 'ALL' | 'PATROL' | 'INCIDENT' | 'TRAFFIC' | 'INSPECTION';
export type ShiftFilter = 'ALL' | 'MORNING' | 'AFTERNOON' | 'NIGHT';
export type StatusFilter = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';

export const TRIPOLI_SPECIFIC_LOCATIONS = [
  'Al-Tall',
  'Al-Mina',
  'Abou Samara',
  'Al-Qobbeh',
  'Al-Tebbaneh',
  'Al-Baddawi',
  'Al-Bahsas',
  'Al-Maarad',
  'Central Tripoli',
  'Dam w Farez',
  'Jabal Mohsen',
  'Al-Souika',
  'Baby Al-Raml',
  'Tripoli Serail',
  'Tripoli Emergency Detachment',
  'Tripoli Traffic Detachment',
  'Mar Elias',
  'Mar Maroun',
  'Al-Nini',
  'Are Street Mashrou Al-Hariri',
  'Azmi',
  'Al-Hadid',
  'Old City',
] as const;

export type LocationFilter = 'ALL' | (typeof TRIPOLI_SPECIFIC_LOCATIONS)[number];

export interface FilterState {
  officer: string;
  reportType: MissionCategoryFilter;
  priority: SeverityFilter;
  startDate: string;
  endDate: string;
  shift: ShiftFilter;
  location: LocationFilter;
  status: StatusFilter;
}

export interface DailyOfficerRecord {
  name: string;
  dutyHours: string;
  distance: string;
  assigned: Record<SeverityFilter, number>;
  completed: Record<SeverityFilter, number>;
  cancelled: Record<SeverityFilter, number>;
  panic: number;
  shift: ShiftFilter;
  location: LocationFilter;
  status: StatusFilter;
  reportType: MissionCategoryFilter;
  priority: SeverityFilter;
  date: string;
}

export interface WeeklyOfficerRecord {
  name: string;
  completed: number;
  avgTime: string;
  shift: ShiftFilter;
  location: LocationFilter;
  priority: SeverityFilter;
  reportType: MissionCategoryFilter;
}

export const dailyOfficerData: DailyOfficerRecord[] = [
  {
    name: 'Karim Haddad',
    dutyHours: '7h 42m',
    distance: '18.4 km',
    assigned: { ALL: 6, URGENT: 1, HIGH: 2, LOW: 3 },
    completed: { ALL: 5, URGENT: 1, HIGH: 2, LOW: 2 },
    cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
    panic: 1,
    shift: 'MORNING',
    location: 'Al-Mina',
    status: 'COMPLETED',
    reportType: 'PATROL',
    priority: 'URGENT',
    date: new Date().toISOString().split('T')[0],
  },
  {
    name: 'Layla Mansour',
    dutyHours: '8h 01m',
    distance: '22.1 km',
    assigned: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
    completed: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
    cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
    panic: 0,
    shift: 'MORNING',
    location: 'Al-Tall',
    status: 'COMPLETED',
    reportType: 'INCIDENT',
    priority: 'HIGH',
    date: new Date().toISOString().split('T')[0],
  },
  {
    name: 'Samir Youssef',
    dutyHours: '6h 30m',
    distance: '14.7 km',
    assigned: { ALL: 4, URGENT: 1, HIGH: 1, LOW: 2 },
    completed: { ALL: 3, URGENT: 1, HIGH: 0, LOW: 2 },
    cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    panic: 0,
    shift: 'AFTERNOON',
    location: 'Dam w Farez',
    status: 'IN_PROGRESS',
    reportType: 'TRAFFIC',
    priority: 'LOW',
    date: new Date().toISOString().split('T')[0],
  },
  {
    name: 'Nabil Khoury',
    dutyHours: '5h 15m',
    distance: '11.2 km',
    assigned: { ALL: 3, URGENT: 0, HIGH: 2, LOW: 1 },
    completed: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    panic: 0,
    shift: 'NIGHT',
    location: 'Tripoli Emergency Detachment',
    status: 'CANCELLED',
    reportType: 'INSPECTION',
    priority: 'HIGH',
    date: new Date().toISOString().split('T')[0],
  },
];

export const weeklyOfficerData: WeeklyOfficerRecord[] = [
  { name: 'Layla Mansour', completed: 28, avgTime: '31m', shift: 'MORNING', location: 'Al-Tall', priority: 'HIGH', reportType: 'INCIDENT' },
  { name: 'Karim Haddad', completed: 24, avgTime: '36m', shift: 'MORNING', location: 'Al-Mina', priority: 'URGENT', reportType: 'PATROL' },
  { name: 'Samir Youssef', completed: 19, avgTime: '42m', shift: 'AFTERNOON', location: 'Dam w Farez', priority: 'LOW', reportType: 'TRAFFIC' },
  { name: 'Nabil Khoury', completed: 14, avgTime: '47m', shift: 'NIGHT', location: 'Tripoli Emergency Detachment', priority: 'HIGH', reportType: 'INSPECTION' },
];
export type ReportSubTab = 'Daily activity' | 'Weekly summary';
export type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';

export interface DailyOfficerRecord {
  name: string;
  dutyHours: string;
  distance: string;
  assigned: Record<SeverityFilter, number>;
  completed: Record<SeverityFilter, number>;
  cancelled: Record<SeverityFilter, number>;
  panic: number;
}

export interface WeeklyOfficerRecord {
  name: string;
  completed: number;
  avgTime: string;
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
  },
  {
    name: 'Layla Mansour',
    dutyHours: '8h 01m',
    distance: '22.1 km',
    assigned: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
    completed: { ALL: 5, URGENT: 2, HIGH: 2, LOW: 1 },
    cancelled: { ALL: 0, URGENT: 0, HIGH: 0, LOW: 0 },
    panic: 0,
  },
  {
    name: 'Samir Youssef',
    dutyHours: '6h 30m',
    distance: '14.7 km',
    assigned: { ALL: 4, URGENT: 1, HIGH: 1, LOW: 2 },
    completed: { ALL: 3, URGENT: 1, HIGH: 0, LOW: 2 },
    cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    panic: 0,
  },
  {
    name: 'Nabil Khoury',
    dutyHours: '5h 15m',
    distance: '11.2 km',
    assigned: { ALL: 3, URGENT: 0, HIGH: 2, LOW: 1 },
    completed: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    cancelled: { ALL: 1, URGENT: 0, HIGH: 1, LOW: 0 },
    panic: 0,
  },
];

export const weeklyOfficerData: WeeklyOfficerRecord[] = [
  { name: 'Layla Mansour', completed: 28, avgTime: '31m' },
  { name: 'Karim Haddad', completed: 24, avgTime: '36m' },
  { name: 'Samir Youssef', completed: 19, avgTime: '42m' },
  { name: 'Nabil Khoury', completed: 14, avgTime: '47m' },
];
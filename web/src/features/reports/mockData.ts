import type { TripoliLocation } from '../../data/tripoliLocations';

export type ReportSubTab =
  | 'Daily activity'
  | 'Weekly summary'
  | 'Custom range';

export type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';

export type MissionCategoryFilter =
  | 'ALL'
  | 'PATROL'
  | 'INCIDENT'
  | 'TRAFFIC'
  | 'INSPECTION';

export type ShiftFilter =
  | 'ALL'
  | 'MORNING'
  | 'AFTERNOON'
  | 'NIGHT';

export type StatusFilter =
  | 'ALL'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'CANCELLED';

export type LocationFilter = 'ALL' | TripoliLocation;

export interface FilterState {
  officer: string;
  reportType: MissionCategoryFilter;
  priority: SeverityFilter;
  startDate: string;
  endDate: string;
  location: LocationFilter;
  status: StatusFilter;
  fromTime: string;
  toTime: string;
}

/* =========================================================
   DAILY ACTIVITY
========================================================= */

export interface DailyOfficerRecord {
  name: string;

  shiftStart: string;
  shiftEnd: string;

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

/* =========================================================
   WEEKLY SUMMARY
========================================================= */

export interface WeeklyOfficerRecord {
  name: string;
  completed: number;
  avgTime: string;
  avgAcknowledgement: string;
  dutyHours: string;
  panic: number;

  shift: ShiftFilter;
  location: LocationFilter;
  priority: SeverityFilter;
  reportType: MissionCategoryFilter;
}

/* =========================================================
   OFFICER REPORT
========================================================= */

export interface OfficerMissionRecord {
  id: number;
  officerName: string;
  title: string;

  category: Exclude<MissionCategoryFilter, 'ALL'>;
  priority: Exclude<SeverityFilter, 'ALL'>;
  status: Exclude<StatusFilter, 'ALL'>;
  location: Exclude<LocationFilter, 'ALL'>;

  date: string;

  assignedAt: string;
  acknowledgedAt: string;
  completedAt: string;
}

export interface OfficerPeriodRecord {
  officerName: string;
  date: string;
  dutyMinutes: number;
  distanceKm: number;
  panicEvents: number;
}

export interface OfficerProfile {
  badge: string;
  shift: Exclude<ShiftFilter, 'ALL'>;
  baseLocation: Exclude<LocationFilter, 'ALL'>;
}

export interface OfficerActivityEvent {
  id: number;
  officerName: string;
  date: string;
  time: string;
  location: Exclude<LocationFilter, 'ALL'>;
  activity: string;
  details: string;
  missionId?: number;
}

/* =========================================================
   DATE HELPERS
========================================================= */

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const dateDaysAgo = (daysAgo: number) => {
  const date = new Date();

  date.setDate(date.getDate() - daysAgo);

  return formatLocalDate(date);
};

/* =========================================================
   OFFICER PROFILES
========================================================= */

export const officerProfiles: Record<string, OfficerProfile> = {
  'Karim Haddad': {
    badge: 'MP-1042',
    shift: 'MORNING',
    baseLocation: 'Mina, Tripoli, Lebanon',
  },

  'Layla Mansour': {
    badge: 'MP-1018',
    shift: 'MORNING',
    baseLocation: 'Al Tall, Tripoli, Lebanon',
  },

  'Samir Youssef': {
    badge: 'MP-1031',
    shift: 'AFTERNOON',
    baseLocation: 'Al Dam Wal Farez, Tripoli, Lebanon',
  },

  'Nabil Khoury': {
    badge: 'MP-1056',
    shift: 'NIGHT',
    baseLocation: 'Central, Tripoli, Lebanon',
  },
};

/* =========================================================
   DAILY OFFICER / SHIFT DATA

   One row = one officer's activity for the selected day.
   It is NOT one mission.
========================================================= */

export const dailyOfficerData: DailyOfficerRecord[] = [
  {
    name: 'Karim Haddad',

    shiftStart: '08:00',
    shiftEnd: '15:42',

    dutyHours: '7h 42m',
    distance: '18.4 km',

    assigned: {
      ALL: 6,
      URGENT: 1,
      HIGH: 2,
      LOW: 3,
    },

    completed: {
      ALL: 5,
      URGENT: 1,
      HIGH: 2,
      LOW: 2,
    },

    cancelled: {
      ALL: 0,
      URGENT: 0,
      HIGH: 0,
      LOW: 0,
    },

    panic: 1,

    shift: 'MORNING',
    location: 'Mina, Tripoli, Lebanon',
    status: 'COMPLETED',
    reportType: 'PATROL',
    priority: 'URGENT',

    date: dateDaysAgo(0),
  },

  {
    name: 'Layla Mansour',

    shiftStart: '08:00',
    shiftEnd: '16:01',

    dutyHours: '8h 01m',
    distance: '22.1 km',

    assigned: {
      ALL: 5,
      URGENT: 2,
      HIGH: 2,
      LOW: 1,
    },

    completed: {
      ALL: 5,
      URGENT: 2,
      HIGH: 2,
      LOW: 1,
    },

    cancelled: {
      ALL: 0,
      URGENT: 0,
      HIGH: 0,
      LOW: 0,
    },

    panic: 0,

    shift: 'MORNING',
    location: 'Al Tall, Tripoli, Lebanon',
    status: 'COMPLETED',
    reportType: 'INCIDENT',
    priority: 'HIGH',

    date: dateDaysAgo(0),
  },

  {
    name: 'Samir Youssef',

    shiftStart: '13:00',
    shiftEnd: '19:30',

    dutyHours: '6h 30m',
    distance: '14.7 km',

    assigned: {
      ALL: 4,
      URGENT: 1,
      HIGH: 1,
      LOW: 2,
    },

    completed: {
      ALL: 3,
      URGENT: 1,
      HIGH: 0,
      LOW: 2,
    },

    cancelled: {
      ALL: 1,
      URGENT: 0,
      HIGH: 1,
      LOW: 0,
    },

    panic: 0,

    shift: 'AFTERNOON',
    location: 'Al Dam Wal Farez, Tripoli, Lebanon',
    status: 'IN_PROGRESS',
    reportType: 'TRAFFIC',
    priority: 'LOW',

    date: dateDaysAgo(0),
  },

  {
    name: 'Nabil Khoury',

    shiftStart: '20:00',
    shiftEnd: '01:15',

    dutyHours: '5h 15m',
    distance: '11.2 km',

    assigned: {
      ALL: 3,
      URGENT: 0,
      HIGH: 2,
      LOW: 1,
    },

    completed: {
      ALL: 1,
      URGENT: 0,
      HIGH: 1,
      LOW: 0,
    },

    cancelled: {
      ALL: 1,
      URGENT: 0,
      HIGH: 1,
      LOW: 0,
    },

    panic: 0,

    shift: 'NIGHT',
    location: 'Central, Tripoli, Lebanon',
    status: 'CANCELLED',
    reportType: 'INSPECTION',
    priority: 'HIGH',

    date: dateDaysAgo(0),
  },
];

/* =========================================================
   WEEKLY OFFICER DATA
========================================================= */

export const weeklyOfficerData: WeeklyOfficerRecord[] = [
  {
    name: 'Layla Mansour',
    completed: 28,
    avgTime: '31m',
    avgAcknowledgement: '3m 20s',
    dutyHours: '39h 48m',
    panic: 0,

    shift: 'MORNING',
    location: 'Al Tall, Tripoli, Lebanon',
    priority: 'HIGH',
    reportType: 'INCIDENT',
  },

  {
    name: 'Karim Haddad',
    completed: 24,
    avgTime: '36m',
    avgAcknowledgement: '3m 48s',
    dutyHours: '38h 15m',
    panic: 1,

    shift: 'MORNING',
    location: 'Mina, Tripoli, Lebanon',
    priority: 'URGENT',
    reportType: 'PATROL',
  },

  {
    name: 'Samir Youssef',
    completed: 19,
    avgTime: '42m',
    avgAcknowledgement: '4m 51s',
    dutyHours: '35h 30m',
    panic: 0,

    shift: 'AFTERNOON',
    location: 'Al Dam Wal Farez, Tripoli, Lebanon',
    priority: 'LOW',
    reportType: 'TRAFFIC',
  },

  {
    name: 'Nabil Khoury',
    completed: 14,
    avgTime: '47m',
    avgAcknowledgement: '5m 07s',
    dutyHours: '31h 45m',
    panic: 1,

    shift: 'NIGHT',
    location: 'Central, Tripoli, Lebanon',
    priority: 'HIGH',
    reportType: 'INSPECTION',
  },
];

/* =========================================================
   OFFICER PERIOD ACTIVITY

   Used by:
   Today
   7 Days
   30 Days
   Custom

   These records control:
   - duty hours
   - distance
   - panic totals
========================================================= */

export const officerPeriodData: OfficerPeriodRecord[] = [
  /* ---------------- KARIM ---------------- */

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(0),
    dutyMinutes: 462,
    distanceKm: 18.4,
    panicEvents: 1,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(1),
    dutyMinutes: 480,
    distanceKm: 20.2,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(2),
    dutyMinutes: 455,
    distanceKm: 16.8,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(3),
    dutyMinutes: 470,
    distanceKm: 19.1,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(5),
    dutyMinutes: 428,
    distanceKm: 15.7,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(8),
    dutyMinutes: 475,
    distanceKm: 21.4,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(11),
    dutyMinutes: 460,
    distanceKm: 17.9,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(15),
    dutyMinutes: 485,
    distanceKm: 22.3,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(19),
    dutyMinutes: 440,
    distanceKm: 16.1,
    panicEvents: 1,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(24),
    dutyMinutes: 478,
    distanceKm: 20.7,
    panicEvents: 0,
  },

  {
    officerName: 'Karim Haddad',
    date: dateDaysAgo(28),
    dutyMinutes: 450,
    distanceKm: 18.6,
    panicEvents: 0,
  },

  /* ---------------- LAYLA ---------------- */

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(0),
    dutyMinutes: 481,
    distanceKm: 22.1,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(1),
    dutyMinutes: 476,
    distanceKm: 20.8,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(3),
    dutyMinutes: 490,
    distanceKm: 23.4,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(5),
    dutyMinutes: 465,
    distanceKm: 19.9,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(6),
    dutyMinutes: 477,
    distanceKm: 21.5,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(10),
    dutyMinutes: 482,
    distanceKm: 22.7,
    panicEvents: 0,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(16),
    dutyMinutes: 471,
    distanceKm: 20.3,
    panicEvents: 1,
  },

  {
    officerName: 'Layla Mansour',
    date: dateDaysAgo(22),
    dutyMinutes: 488,
    distanceKm: 23.1,
    panicEvents: 0,
  },

  /* ---------------- SAMIR ---------------- */

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(0),
    dutyMinutes: 390,
    distanceKm: 14.7,
    panicEvents: 0,
  },

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(2),
    dutyMinutes: 430,
    distanceKm: 16.2,
    panicEvents: 0,
  },

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(4),
    dutyMinutes: 445,
    distanceKm: 17.8,
    panicEvents: 0,
  },

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(6),
    dutyMinutes: 420,
    distanceKm: 15.9,
    panicEvents: 0,
  },

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(12),
    dutyMinutes: 438,
    distanceKm: 18.1,
    panicEvents: 1,
  },

  {
    officerName: 'Samir Youssef',
    date: dateDaysAgo(20),
    dutyMinutes: 410,
    distanceKm: 15.2,
    panicEvents: 0,
  },

  /* ---------------- NABIL ---------------- */

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(0),
    dutyMinutes: 315,
    distanceKm: 11.2,
    panicEvents: 0,
  },

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(1),
    dutyMinutes: 410,
    distanceKm: 14.8,
    panicEvents: 0,
  },

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(4),
    dutyMinutes: 425,
    distanceKm: 16.4,
    panicEvents: 1,
  },

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(6),
    dutyMinutes: 405,
    distanceKm: 15.1,
    panicEvents: 0,
  },

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(14),
    dutyMinutes: 418,
    distanceKm: 15.7,
    panicEvents: 0,
  },

  {
    officerName: 'Nabil Khoury',
    date: dateDaysAgo(25),
    dutyMinutes: 430,
    distanceKm: 17.2,
    panicEvents: 0,
  },
];

/* =========================================================
   OFFICER MISSION HISTORY

   These are the individual missions shown only after
   opening an officer's report.

   TODAY < 7 DAYS < 30 DAYS
========================================================= */

export const officerMissionData: OfficerMissionRecord[] = [
  /* =======================================================
     KARIM

     Today:   2
     7 days:  5
     30 days: 8
  ======================================================= */

  {
    id: 1,
    officerName: 'Karim Haddad',
    title: 'Corniche patrol',
    category: 'PATROL',
    priority: 'URGENT',
    status: 'COMPLETED',
    location: 'Mina, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '08:12',
    acknowledgedAt: '08:15',
    completedAt: '08:51',
  },

  {
    id: 2,
    officerName: 'Karim Haddad',
    title: 'Traffic obstruction',
    category: 'TRAFFIC',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Mina, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '10:05',
    acknowledgedAt: '10:09',
    completedAt: '10:42',
  },

  {
    id: 3,
    officerName: 'Karim Haddad',
    title: 'Public disturbance check',
    category: 'INCIDENT',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Al Tall, Tripoli, Lebanon',
    date: dateDaysAgo(1),
    assignedAt: '12:30',
    acknowledgedAt: '12:34',
    completedAt: '13:10',
  },

  {
    id: 4,
    officerName: 'Karim Haddad',
    title: 'Routine area patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Old City, Tripoli, Lebanon',
    date: dateDaysAgo(3),
    assignedAt: '14:00',
    acknowledgedAt: '14:04',
    completedAt: '14:39',
  },

  {
    id: 5,
    officerName: 'Karim Haddad',
    title: 'Vehicle inspection',
    category: 'INSPECTION',
    priority: 'LOW',
    status: 'CANCELLED',
    location: 'Azmi Street, Tripoli, Lebanon',
    date: dateDaysAgo(5),
    assignedAt: '15:12',
    acknowledgedAt: '15:16',
    completedAt: '—',
  },

  {
    id: 6,
    officerName: 'Karim Haddad',
    title: 'Market patrol',
    category: 'PATROL',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Central, Tripoli, Lebanon',
    date: dateDaysAgo(9),
    assignedAt: '09:05',
    acknowledgedAt: '09:08',
    completedAt: '09:44',
  },

  {
    id: 7,
    officerName: 'Karim Haddad',
    title: 'Traffic support',
    category: 'TRAFFIC',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Al Tall, Tripoli, Lebanon',
    date: dateDaysAgo(15),
    assignedAt: '11:20',
    acknowledgedAt: '11:25',
    completedAt: '12:02',
  },

  {
    id: 8,
    officerName: 'Karim Haddad',
    title: 'Inspection follow-up',
    category: 'INSPECTION',
    priority: 'HIGH',
    status: 'CANCELLED',
    location: 'Al Maarad, Tripoli, Lebanon',
    date: dateDaysAgo(23),
    assignedAt: '13:10',
    acknowledgedAt: '13:15',
    completedAt: '—',
  },

  /* =======================================================
     LAYLA

     Today:   2
     7 days:  6
     30 days: 9
  ======================================================= */

  {
    id: 20,
    officerName: 'Layla Mansour',
    title: 'Incident response',
    category: 'INCIDENT',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Al Tall, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '08:20',
    acknowledgedAt: '08:23',
    completedAt: '08:55',
  },

  {
    id: 21,
    officerName: 'Layla Mansour',
    title: 'School zone patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Azmi Street, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '10:05',
    acknowledgedAt: '10:08',
    completedAt: '10:36',
  },

  {
    id: 22,
    officerName: 'Layla Mansour',
    title: 'Market patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Central, Tripoli, Lebanon',
    date: dateDaysAgo(2),
    assignedAt: '10:10',
    acknowledgedAt: '10:13',
    completedAt: '10:46',
  },

  {
    id: 23,
    officerName: 'Layla Mansour',
    title: 'Traffic assistance',
    category: 'TRAFFIC',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Azmi Street, Tripoli, Lebanon',
    date: dateDaysAgo(3),
    assignedAt: '12:40',
    acknowledgedAt: '12:43',
    completedAt: '13:18',
  },

  {
    id: 24,
    officerName: 'Layla Mansour',
    title: 'Public disturbance',
    category: 'INCIDENT',
    priority: 'URGENT',
    status: 'COMPLETED',
    location: 'Old City, Tripoli, Lebanon',
    date: dateDaysAgo(5),
    assignedAt: '13:25',
    acknowledgedAt: '13:28',
    completedAt: '14:01',
  },

  {
    id: 25,
    officerName: 'Layla Mansour',
    title: 'Shop inspection',
    category: 'INSPECTION',
    priority: 'LOW',
    status: 'CANCELLED',
    location: 'Al Maarad, Tripoli, Lebanon',
    date: dateDaysAgo(6),
    assignedAt: '15:10',
    acknowledgedAt: '15:14',
    completedAt: '—',
  },

  {
    id: 26,
    officerName: 'Layla Mansour',
    title: 'Traffic crossing support',
    category: 'TRAFFIC',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Bahsas, Tripoli, Lebanon',
    date: dateDaysAgo(10),
    assignedAt: '09:40',
    acknowledgedAt: '09:43',
    completedAt: '10:17',
  },

  {
    id: 27,
    officerName: 'Layla Mansour',
    title: 'Public complaint',
    category: 'INCIDENT',
    priority: 'LOW',
    status: 'CANCELLED',
    location: 'Old City, Tripoli, Lebanon',
    date: dateDaysAgo(16),
    assignedAt: '14:30',
    acknowledgedAt: '14:34',
    completedAt: '—',
  },

  {
    id: 28,
    officerName: 'Layla Mansour',
    title: 'Morning patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Old City, Tripoli, Lebanon',
    date: dateDaysAgo(24),
    assignedAt: '08:30',
    acknowledgedAt: '08:33',
    completedAt: '09:08',
  },

  /* =======================================================
     SAMIR

     Today:   2
     7 days:  5
     30 days: 8
  ======================================================= */

  {
    id: 30,
    officerName: 'Samir Youssef',
    title: 'Traffic congestion',
    category: 'TRAFFIC',
    priority: 'LOW',
    status: 'IN_PROGRESS',
    location: 'Al Dam Wal Farez, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '13:10',
    acknowledgedAt: '13:15',
    completedAt: '—',
  },

  {
    id: 31,
    officerName: 'Samir Youssef',
    title: 'Afternoon patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Al Dam Wal Farez, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '14:05',
    acknowledgedAt: '14:10',
    completedAt: '14:48',
  },

  {
    id: 32,
    officerName: 'Samir Youssef',
    title: 'Road obstruction',
    category: 'TRAFFIC',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Al Maarad, Tripoli, Lebanon',
    date: dateDaysAgo(2),
    assignedAt: '15:20',
    acknowledgedAt: '15:25',
    completedAt: '16:04',
  },

  {
    id: 33,
    officerName: 'Samir Youssef',
    title: 'Vehicle inspection',
    category: 'INSPECTION',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Azmi Street, Tripoli, Lebanon',
    date: dateDaysAgo(4),
    assignedAt: '16:10',
    acknowledgedAt: '16:15',
    completedAt: '16:49',
  },

  {
    id: 34,
    officerName: 'Samir Youssef',
    title: 'Traffic support',
    category: 'TRAFFIC',
    priority: 'URGENT',
    status: 'CANCELLED',
    location: 'Central, Tripoli, Lebanon',
    date: dateDaysAgo(6),
    assignedAt: '17:00',
    acknowledgedAt: '17:05',
    completedAt: '—',
  },

  {
    id: 35,
    officerName: 'Samir Youssef',
    title: 'Evening patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Mina, Tripoli, Lebanon',
    date: dateDaysAgo(12),
    assignedAt: '17:10',
    acknowledgedAt: '17:15',
    completedAt: '17:54',
  },

  {
    id: 36,
    officerName: 'Samir Youssef',
    title: 'Public incident support',
    category: 'INCIDENT',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Al Qobbe, Tripoli, Lebanon',
    date: dateDaysAgo(18),
    assignedAt: '15:40',
    acknowledgedAt: '15:45',
    completedAt: '16:28',
  },

  {
    id: 37,
    officerName: 'Samir Youssef',
    title: 'Area inspection',
    category: 'INSPECTION',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Haddadine, Tripoli, Lebanon',
    date: dateDaysAgo(27),
    assignedAt: '14:20',
    acknowledgedAt: '14:25',
    completedAt: '15:01',
  },

  /* =======================================================
     NABIL

     Today:   2
     7 days:  5
     30 days: 8
  ======================================================= */

  {
    id: 40,
    officerName: 'Nabil Khoury',
    title: 'Night inspection',
    category: 'INSPECTION',
    priority: 'HIGH',
    status: 'CANCELLED',
    location: 'Central, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '21:20',
    acknowledgedAt: '21:25',
    completedAt: '—',
  },

  {
    id: 41,
    officerName: 'Nabil Khoury',
    title: 'Emergency detachment patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'IN_PROGRESS',
    location: 'Central, Tripoli, Lebanon',
    date: dateDaysAgo(0),
    assignedAt: '22:10',
    acknowledgedAt: '22:16',
    completedAt: '—',
  },

  {
    id: 42,
    officerName: 'Nabil Khoury',
    title: 'Night traffic support',
    category: 'TRAFFIC',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Al Qobbe, Tripoli, Lebanon',
    date: dateDaysAgo(1),
    assignedAt: '21:40',
    acknowledgedAt: '21:46',
    completedAt: '22:27',
  },

  {
    id: 43,
    officerName: 'Nabil Khoury',
    title: 'Night patrol',
    category: 'PATROL',
    priority: 'LOW',
    status: 'COMPLETED',
    location: 'Al Qobbe, Tripoli, Lebanon',
    date: dateDaysAgo(4),
    assignedAt: '22:10',
    acknowledgedAt: '22:16',
    completedAt: '22:58',
  },

  {
    id: 44,
    officerName: 'Nabil Khoury',
    title: 'Late-night inspection',
    category: 'INSPECTION',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Jabal Mohsen, Tripoli, Lebanon',
    date: dateDaysAgo(6),
    assignedAt: '23:05',
    acknowledgedAt: '23:10',
    completedAt: '23:52',
  },

  {
    id: 45,
    officerName: 'Nabil Khoury',
    title: 'Public disturbance response',
    category: 'INCIDENT',
    priority: 'URGENT',
    status: 'COMPLETED',
    location: 'Tabbaneh, Tripoli, Lebanon',
    date: dateDaysAgo(11),
    assignedAt: '22:35',
    acknowledgedAt: '22:40',
    completedAt: '23:21',
  },

  {
    id: 46,
    officerName: 'Nabil Khoury',
    title: 'Incident support',
    category: 'INCIDENT',
    priority: 'HIGH',
    status: 'COMPLETED',
    location: 'Jabal Mohsen, Tripoli, Lebanon',
    date: dateDaysAgo(18),
    assignedAt: '23:05',
    acknowledgedAt: '23:10',
    completedAt: '23:52',
  },

  {
    id: 47,
    officerName: 'Nabil Khoury',
    title: 'Night area inspection',
    category: 'INSPECTION',
    priority: 'LOW',
    status: 'CANCELLED',
    location: 'Bahsas, Tripoli, Lebanon',
    date: dateDaysAgo(26),
    assignedAt: '21:55',
    acknowledgedAt: '22:01',
    completedAt: '—',
  },
];

/* =========================================================
   DAILY ACTIVITY TIMELINE MOCK DATA

   Used by the web report prototype to demonstrate historical
   area/time lookups and "what was the officer doing?" details.
========================================================= */

export const officerActivityData: OfficerActivityEvent[] = [
  { id: 1001, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '08:00', location: 'Mina, Tripoli, Lebanon', activity: 'Started duty', details: 'Officer came on duty.' },
  { id: 1002, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '08:12', location: 'Mina, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Corniche patrol', missionId: 1 },
  { id: 1003, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '08:15', location: 'Mina, Tripoli, Lebanon', activity: 'Mission acknowledged', details: 'Corniche patrol', missionId: 1 },
  { id: 1004, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '08:51', location: 'Mina, Tripoli, Lebanon', activity: 'Mission completed', details: 'Corniche patrol', missionId: 1 },
  { id: 1005, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '09:20', location: 'Mina, Tripoli, Lebanon', activity: 'Available', details: 'No active mission.' },
  { id: 1006, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '10:05', location: 'Mina, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Traffic obstruction', missionId: 2 },
  { id: 1007, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '10:42', location: 'Mina, Tripoli, Lebanon', activity: 'Mission completed', details: 'Traffic obstruction', missionId: 2 },
  { id: 1008, officerName: 'Karim Haddad', date: dateDaysAgo(0), time: '15:42', location: 'Mina, Tripoli, Lebanon', activity: 'Ended duty', details: 'Officer went off duty.' },

  { id: 1101, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '08:00', location: 'Al Tall, Tripoli, Lebanon', activity: 'Started duty', details: 'Officer came on duty.' },
  { id: 1102, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '08:20', location: 'Al Tall, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Incident response', missionId: 20 },
  { id: 1103, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '08:55', location: 'Al Tall, Tripoli, Lebanon', activity: 'Mission completed', details: 'Incident response', missionId: 20 },
  { id: 1104, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '09:30', location: 'Azmi Street, Tripoli, Lebanon', activity: 'Available', details: 'No active mission.' },
  { id: 1105, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '10:05', location: 'Azmi Street, Tripoli, Lebanon', activity: 'Mission assigned', details: 'School zone patrol', missionId: 21 },
  { id: 1106, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '10:36', location: 'Azmi Street, Tripoli, Lebanon', activity: 'Mission completed', details: 'School zone patrol', missionId: 21 },
  { id: 1107, officerName: 'Layla Mansour', date: dateDaysAgo(0), time: '16:01', location: 'Central, Tripoli, Lebanon', activity: 'Ended duty', details: 'Officer went off duty.' },

  { id: 1201, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '13:00', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Started duty', details: 'Officer came on duty.' },
  { id: 1202, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '13:10', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Traffic congestion', missionId: 30 },
  { id: 1203, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '13:15', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Mission acknowledged', details: 'Traffic congestion', missionId: 30 },
  { id: 1204, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '14:05', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Afternoon patrol', missionId: 31 },
  { id: 1205, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '14:48', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Mission completed', details: 'Afternoon patrol', missionId: 31 },
  { id: 1206, officerName: 'Samir Youssef', date: dateDaysAgo(0), time: '19:30', location: 'Al Dam Wal Farez, Tripoli, Lebanon', activity: 'Ended duty', details: 'Officer went off duty.' },

  { id: 1301, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '20:00', location: 'Central, Tripoli, Lebanon', activity: 'Started duty', details: 'Officer came on duty.' },
  { id: 1302, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '21:20', location: 'Central, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Night inspection', missionId: 40 },
  { id: 1303, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '21:25', location: 'Central, Tripoli, Lebanon', activity: 'Mission acknowledged', details: 'Night inspection', missionId: 40 },
  { id: 1304, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '21:40', location: 'Central, Tripoli, Lebanon', activity: 'Mission cancelled', details: 'Night inspection', missionId: 40 },
  { id: 1305, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '22:10', location: 'Central, Tripoli, Lebanon', activity: 'Mission assigned', details: 'Emergency detachment patrol', missionId: 41 },
  { id: 1306, officerName: 'Nabil Khoury', date: dateDaysAgo(0), time: '01:15', location: 'Central, Tripoli, Lebanon', activity: 'Ended duty', details: 'Officer went off duty.' },
];

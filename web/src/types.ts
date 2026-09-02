export type TabType = 'Live map' | 'Missions' | 'Reports' | 'Users';
export type ReportSubTab = 'Daily activity' | 'Weekly summary';
export type MissionPriority = 'Urgent' | 'High' | 'Low';
export type MissionStatus = 'In progress' | 'Acknowledged' | 'New' | 'Completed' | 'Cancelled';
export type UserRole = 'Officer' | 'Dispatcher' | 'Supervisor';
export type UserStatus = 'Active' | 'Inactive';
export type SeverityFilter = 'ALL' | 'URGENT' | 'HIGH' | 'LOW';

export interface SystemUser {
  id: string;
  name: string;
  badge: string;
  role: UserRole;
  phone: string;
  status: UserStatus;
}

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  badge_number: string;
  role: 'officer' | 'dispatcher' | 'supervisor';
  preferred_language: string;
}

export interface Officer {
  id: string;
  name: string;
  badge: string;
  status: 'Available' | 'On mission' | 'Offline' | 'Panic';
  details: string;
  dutyTime: string;
  distanceCovered: string;
  coords: [number, number];
}

export interface LifecycleStep {
  label: string;
  time?: string;
  subtext?: string;
  status: 'completed' | 'active' | 'pending';
}

export interface Mission {
  id: string;
  title: string;
  priority: MissionPriority;
  status: MissionStatus;
  assignedTo: string;
  badge: string;
  address: string;
  created: string;
  description?: string;
  officerNotes?: string;
  photos?: string[];
  lifecycle?: LifecycleStep[];
}
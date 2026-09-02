export type UserRole = 'officer' | 'dispatcher' | 'supervisor';

export type LanguageCode = 'ar' | 'en';

export interface LoginUser {
  id: number;
  full_name: string;
  badge_number: string;
  role: UserRole;
  preferred_language: LanguageCode;
}

/** The full user record from GET /users/ and GET /users/me/. */
export interface User extends LoginUser {
  username: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: LoginUser;
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
import type { User, UserRole, LanguageCode } from '../auth/types';

export type { User, UserRole, LanguageCode };

/** Body for POST /users/. Matches UserCreateSerializer. */
export interface CreateUserRequest {
  username: string;
  password: string;
  full_name: string;
  badge_number: string;
  phone: string;
  role: UserRole;
  preferred_language: LanguageCode;
}

/** Body for PATCH /users/{id}/. Matches UserUpdateSerializer. */
export interface UpdateUserRequest {
  full_name?: string;
  phone?: string;
  role?: UserRole;
  preferred_language?: LanguageCode;
  is_active?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
}
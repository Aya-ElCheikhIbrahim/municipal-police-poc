import { apiClient } from '../../shared/api/client';
import type { Paginated } from '../../shared/api/client';
import type { User, CreateUserRequest, UpdateUserRequest, UserFilters } from './types';

function toQueryString(filters: UserFilters): string {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * All of these require the supervisor role except where noted :
 * UserViewSet has permission_classes = [IsSupervisor].
 */
export const usersApi = {
  /** GET /users/ : filtering happens server-side. */
  list: (filters: UserFilters = {}) =>
    apiClient.get<Paginated<User>>(`/users/${toQueryString(filters)}`),

  detail: (id: number) => apiClient.get<User>(`/users/${id}/`),

  create: (payload: CreateUserRequest) => apiClient.post<User>('/users/', payload),

  update: (id: number, payload: UpdateUserRequest) =>
    apiClient.patch<User>(`/users/${id}/`, payload),

  activate: (id: number) => apiClient.post<User>(`/users/${id}/activate/`, {}),

  deactivate: (id: number) => apiClient.post<User>(`/users/${id}/deactivate/`, {}),
};
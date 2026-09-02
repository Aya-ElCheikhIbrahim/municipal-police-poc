import { apiClient } from '../../shared/api/client';
import type {
  MissionListItem,
  MissionDetail,
  CreateMissionRequest,
  MissionFilters,
} from './types';

function toQueryString(filters: MissionFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.officer_id !== undefined) params.set('officer_id', String(filters.officer_id));
  if (filters.date) params.set('date', filters.date);
  if (filters.open) params.set('open', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const missionsApi = {
  /**
   * GET /missions/ : a bare array, not a page envelope. MissionListCreateView
   * is an APIView, so DRF pagination does not apply.
   */
  list: (filters: MissionFilters = {}) =>
    apiClient.get<MissionListItem[]>(`/missions/${toQueryString(filters)}`),

  detail: (id: number) => apiClient.get<MissionDetail>(`/missions/${id}/`),

  /** POST /missions/ : pass assigned_to_id to create and assign in one call. */
  create: (payload: CreateMissionRequest) =>
    apiClient.post<MissionDetail>('/missions/', payload),

  /**
   * POST /missions/{id}/assign/ : the server decides assign vs reassign from
   * the mission's current status. Only valid before acknowledgement.
   */
  assign: (id: number, officerId: number) =>
    apiClient.post<MissionDetail>(`/missions/${id}/assign/`, { officer_id: officerId }),

  /** POST /missions/{id}/cancel/ : reason is required by the serializer. */
  cancel: (id: number, reason: string) =>
    apiClient.post<MissionDetail>(`/missions/${id}/cancel/`, { reason }),

  /** POST /missions/{id}/notes/ : appends to the timeline. */
  addNote: (id: number, text: string) =>
    apiClient.post<MissionDetail>(`/missions/${id}/notes/`, { text }),
};
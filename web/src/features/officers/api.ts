import { apiClient } from '../../shared/api/client';
import type { ActiveOfficer, OfficerTrail } from './types';

export const officersApi = {
  listActive: () => apiClient.get<ActiveOfficer[]>('/shifts/active/'),
  /**
   * GET /shifts/active/ : every officer currently on shift, with their last
   */
  getTrail: (officerId: number, date?: string) =>
    apiClient.get<OfficerTrail>(
      `/officers/${officerId}/trail/${date ? `?date=${date}` : ''}`,
    ),
};
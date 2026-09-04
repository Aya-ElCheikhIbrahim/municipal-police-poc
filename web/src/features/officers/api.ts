import { apiClient } from '../../shared/api/client';
import type { ActiveOfficer } from './types';

export const officersApi = {
  /**
   * GET /shifts/active/ : every officer currently on shift, with their last
   */
  listActive: () => apiClient.get<ActiveOfficer[]>('/shifts/active/'),
};
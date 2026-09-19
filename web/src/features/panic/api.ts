import { apiClient } from '../../shared/api/client';
import type { PanicAlert } from './types';

export const panicApi = {
  /** GET /api/v1/panic/active/ — every alert still open, oldest first. */
  listActive: () => apiClient.get<PanicAlert[]>('/panic/active/'),

  /** POST /api/v1/panic/{id}/resolve/ — a dispatcher or supervisor closes the alert. */
  resolve: (id: number, notes?: string) =>
    apiClient.post<PanicAlert>(`/panic/${id}/resolve/`, notes ? { notes } : {}),
};

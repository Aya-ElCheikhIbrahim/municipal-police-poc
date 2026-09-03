const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  throw new Error('VITE_API_URL is not set. Add it to web/.env');
}

const ACCESS_KEY = 'access';
const REFRESH_KEY = 'refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

let onSessionExpired: () => void = () => {};

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}


let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  const refresh = tokenStore.getRefresh();
  if (!refresh) return Promise.reject(new Error('No refresh token'));

  refreshInFlight = fetch(`${BASE_URL}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh rejected');
            const data = await res.json();
      if (data.refresh) {
        tokenStore.set(data.access, data.refresh);
      } else {
        tokenStore.setAccess(data.access);
      }
      return data.access as string;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  anonymous?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options;

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send(anonymous ? null : tokenStore.getAccess());

  if (response.status === 401 && !anonymous) {
    try {
      const newAccess = await refreshAccessToken();
      response = await send(newAccess);
    } catch {
      tokenStore.clear();
      onSessionExpired();
      throw new ApiError(401, null, 'Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
    }
    throw new ApiError(
      response.status,
      errorBody,
      describeError(response.status, errorBody),
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function describeError(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const first = record.detail ?? Object.values(record)[0];
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  if (status === 403) return 'You do not have permission to do that.';
  if (status >= 500) return 'The server ran into a problem. Try again shortly.';
  return `Request failed (${status}).`;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: { anonymous?: boolean }) =>
    request<T>(path, { method: 'POST', body, ...opts }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { usersApi } from './api';
import type { User, CreateUserRequest, UserFilters } from './types';

interface UseUsersResult {
  users: User[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createUser: (payload: CreateUserRequest) => Promise<User>;
  setActive: (id: number, active: boolean) => Promise<void>;
}

export function useUsers(filters: UserFilters = {}): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await usersApi.list(JSON.parse(filterKey) as UserFilters);
      setUsers(page.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.');
    } finally {
      setIsLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createUser(payload: CreateUserRequest): Promise<User> {
    const created = await usersApi.create(payload);
    await refresh();
    return created;
  }

  async function setActive(id: number, active: boolean): Promise<void> {
    if (active) {
      await usersApi.activate(id);
    } else {
      await usersApi.deactivate(id);
    }
    await refresh();
  }

  return { users, isLoading, error, refresh, createUser, setActive };
}
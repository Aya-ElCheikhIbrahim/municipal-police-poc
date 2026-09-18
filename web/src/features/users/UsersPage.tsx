import { useState } from 'react';
import { useUsers } from './useUsers';
import { AddUserForm } from './AddUserForm';
import { roleLabel } from '../auth/types';
import type { CreateUserRequest, UserFilters } from './types';

export function UsersPage() {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const filters: UserFilters = showActiveOnly ? { is_active: true } : {};
  const { users, isLoading, error, createUser, setActive } = useUsers(filters);

  async function handleCreate(payload: CreateUserRequest) {
    await createUser(payload);
    setIsAddingUser(false);
  }

  if (isAddingUser) {
    return (
      <div className="flex-1 bg-slate-50 p-4 sm:p-6 overflow-y-auto">
        <AddUserForm onSubmit={handleCreate} onCancel={() => setIsAddingUser(false)} />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
      {/* Filters bar stays fixed at the top; only the user list below scrolls. */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <FilterButton active={!showActiveOnly} onClick={() => setShowActiveOnly(false)}>
            All roles
          </FilterButton>
          <FilterButton active={showActiveOnly} onClick={() => setShowActiveOnly(true)}>
            Active only
          </FilterButton>
        </div>

        <button
          onClick={() => setIsAddingUser(true)}
          className="bg-[#1F3864] hover:bg-[#182c50] text-white text-sm lg:text-base font-semibold px-4 lg:px-5 py-2 rounded-md transition-colors shadow-xs cursor-pointer"
        >
          Add user
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-4 pb-4 sm:pb-6 flex flex-col space-y-4 lg:space-y-5">
        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-4 py-2">
            {error}
          </div>
        )}

        {/* Mobile: stacked cards */}
        <div className="sm:hidden space-y-3">
          {isLoading ? (
            <SkeletonCards />
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
              No users match this filter.
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-lg border border-slate-200/80 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900 text-lg">{user.full_name}</div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold shrink-0 ${
                      user.is_active
                        ? 'bg-emerald-100/70 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  Badge {user.badge_number} · {roleLabel(user.role)}
                </div>
                <div className="text-sm text-slate-600 font-mono">{user.phone || '—'}</div>
                <button
                  onClick={() => setActive(user.id, !user.is_active)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold text-base cursor-pointer pt-1"
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Tablet/desktop: table. The box shrinks to the space left and scrolls itself,
            so the column names (sticky cells below) stay visible. */}
        <div className="hidden sm:block min-h-0 bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-auto">
          <table className="w-full text-left text-sm lg:text-base border-collapse">
            <thead>
              <tr className="text-slate-400 font-semibold uppercase tracking-wider text-xs lg:text-sm *:sticky *:top-0 *:z-10 *:bg-slate-50 *:shadow-[inset_0_-1px_0_var(--color-slate-200)]">
                <th className="px-4 py-3">NAME</th>
                <th className="px-4 py-3">BADGE</th>
                <th className="px-4 py-3">ROLE</th>
                <th className="px-4 py-3">PHONE</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <SkeletonRows />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm lg:text-base text-slate-500">
                    No users match this filter.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{user.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{user.badge_number}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{user.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs lg:text-sm font-semibold ${
                          user.is_active
                            ? 'bg-emerald-100/70 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setActive(user.id, !user.is_active)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm lg:text-base cursor-pointer"
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 lg:px-4 py-1.5 rounded-md text-sm lg:text-base font-semibold border transition-all cursor-pointer ${
        active
          ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
          : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((row) => (
        <tr key={row} className="animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((cell) => (
            <td key={cell} className="px-4 py-3">
              <div className="h-4 bg-slate-200 rounded-full w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <>
      {[1, 2, 3].map((row) => (
        <div key={row} className="bg-white rounded-lg border border-slate-200/80 p-4 space-y-2 animate-pulse">
          <div className="h-4 bg-slate-200 rounded-full w-1/2"></div>
          <div className="h-3 bg-slate-200 rounded-full w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded-full w-1/3"></div>
        </div>
      ))}
    </>
  );
}
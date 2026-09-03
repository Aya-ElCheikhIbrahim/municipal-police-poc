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
      <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
        <AddUserForm onSubmit={handleCreate} onCancel={() => setIsAddingUser(false)} />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilterButton active={!showActiveOnly} onClick={() => setShowActiveOnly(false)}>
              All roles
            </FilterButton>
            <FilterButton active={showActiveOnly} onClick={() => setShowActiveOnly(true)}>
              Active only
            </FilterButton>
          </div>

          <button
            onClick={() => setIsAddingUser(true)}
            className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            Add user
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                <th className="p-3.5">NAME</th>
                <th className="p-3.5">BADGE</th>
                <th className="p-3.5">ROLE</th>
                <th className="p-3.5">PHONE</th>
                <th className="p-3.5">STATUS</th>
                <th className="p-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <SkeletonRows />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No users match this filter.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">{user.full_name}</td>
                    <td className="p-3.5 text-slate-600">{user.badge_number}</td>
                    <td className="p-3.5 text-slate-600">{roleLabel(user.role)}</td>
                    <td className="p-3.5 text-slate-600 font-mono">{user.phone || '—'}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          user.is_active
                            ? 'bg-emerald-100/70 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setActive(user.id, !user.is_active)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer"
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
      className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
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
            <td key={cell} className="p-3.5">
              <div className="h-2.5 bg-slate-200 rounded-full w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
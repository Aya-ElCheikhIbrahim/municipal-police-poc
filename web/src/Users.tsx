import React, { useState } from 'react';
import type { SystemUser, UserRole } from './types';
interface UsersProps {
  usersList: SystemUser[];
  setUsersList: React.Dispatch<React.SetStateAction<SystemUser[]>>;
  isAddingUser: boolean;
  setIsAddingUser: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Users({
  usersList,
  setUsersList,
  isAddingUser,
  setIsAddingUser,
}: UsersProps) {
  const [activeUserFilter, setActiveUserFilter] = useState<'All' | 'ActiveOnly'>('All');

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserBadge, setNewUserBadge] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('+961 ');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Officer');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const filteredUsers = usersList.filter((u) => {
    if (activeUserFilter === 'ActiveOnly') return u.status === 'Active';
    return true;
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName) return;

    const newUser: SystemUser = {
      id: `user_${Date.now()}`,
      name: newUserName,
      badge: newUserBadge || '—',
      role: newUserRole,
      phone: newUserPhone,
      status: 'Active',
    };

    setUsersList([...usersList, newUser]);
    setIsAddingUser(false);

    setNewUserName('');
    setNewUserBadge('');
    setNewUserPhone('+961 ');
    setNewUserRole('Officer');
    setNewUserUsername('');
    setNewUserPassword('');
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      {!isAddingUser ? (
        <div className="space-y-4 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveUserFilter('All')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  activeUserFilter === 'All'
                    ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                All roles
              </button>
              <button
                onClick={() => setActiveUserFilter('ActiveOnly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  activeUserFilter === 'ActiveOnly'
                    ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                Active only
              </button>
            </div>

            <button
              onClick={() => setIsAddingUser(true)}
              className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Add user
            </button>
          </div>

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
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">{u.name}</td>
                    <td className="p-3.5 text-slate-600">{u.badge}</td>
                    <td className="p-3.5 text-slate-600">{u.role}</td>
                    <td className="p-3.5 text-slate-600 font-mono">{u.phone}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.status === 'Active'
                            ? 'bg-emerald-100/70 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs p-8 max-w-2xl mx-auto mt-2">
          <h2 className="text-base font-bold text-slate-900 mb-6">Add user</h2>

          <form onSubmit={handleCreateUser} className="space-y-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Badge number</label>
                <input
                  type="text"
                  placeholder="e.g. 214"
                  value={newUserBadge}
                  onChange={(e) => setNewUserBadge(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                <input
                  type="text"
                  placeholder="+961"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864] bg-white text-slate-600"
                >
                  <option value="Officer">Officer</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
                <input
                  type="text"
                  placeholder="Used to sign in"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary password</label>
                <input
                  type="password"
                  placeholder="Set a starting password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                className="bg-[#1F3864] hover:bg-[#182c50] text-white text-xs font-semibold px-5 py-2.5 rounded-md transition-colors shadow-xs cursor-pointer"
              >
                Create user
              </button>
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
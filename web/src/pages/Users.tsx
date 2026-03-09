import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { getAdminUsers, updateUserRole, deleteUser } from '../api/client';
import { formatDate } from '../utils/dates';
import type { User } from '../types';

type SortField = 'display_name' | 'role' | 'created_at';
type SortDir = 'asc' | 'desc';

const ROLES = ['developer', 'reviewer', 'admin'] as const;

const roleBadgeClass: Record<string, string> = {
  developer: 'bg-gray-100 text-gray-700',
  reviewer: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
};

export default function Users() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: getAdminUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setConfirmDelete(null);
    },
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = (users ?? [])
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.display_name.toLowerCase().includes(q) ||
        u.github_login.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'display_name') {
        cmp = a.display_name.localeCompare(b.display_name);
      } else if (sortField === 'role') {
        cmp = a.role.localeCompare(b.role);
      } else {
        cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 inline ml-0.5" />
      : <ChevronDown className="w-3.5 h-3.5 inline ml-0.5" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Users</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or GitHub login..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('display_name')}>
                  User <SortIcon field="display_name" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('role')}>
                  Role <SortIcon field="role" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                  Joined <SortIcon field="created_at" />
                </th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url && (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{u.display_name}</div>
                        <div className="text-xs text-gray-500">{u.github_login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleBadgeClass[u.role] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {u.created_at ? formatDate(u.created_at) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {confirmDelete === u.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(u.id)}
                          className="text-xs text-red-600 font-medium hover:text-red-800"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

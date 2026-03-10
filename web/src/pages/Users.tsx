import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { getAdminUsers, updateUserRole, deleteUser } from '../api/client';
import { formatDate } from '../utils/dates';


type SortField = 'display_name' | 'role' | 'created_at';
type SortDir = 'asc' | 'desc';

const ROLES = ['developer', 'reviewer', 'admin'] as const;

const roleBadgeClass: Record<string, string> = {
  developer: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  reviewer: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
  admin: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Users</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or GitHub login..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url && (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.display_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{u.github_login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleBadgeClass[u.role] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {u.created_at ? formatDate(u.created_at) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {confirmDelete === u.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(u.id)}
                          className="text-xs text-red-600 dark:text-red-400 font-medium hover:text-red-800 dark:hover:text-red-300"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, EyeOff, Trash2 } from 'lucide-react';
import { getAdminApps, unpublishApp, deleteApp } from '../api/client';
import type { App } from '../types';

export default function AdminApps() {
  const queryClient = useQueryClient();
  const { data: apps, isLoading } = useQuery({
    queryKey: ['adminApps'],
    queryFn: getAdminApps,
  });

  const [unpublishTarget, setUnpublishTarget] = useState<App | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const unpublishMutation = useMutation({
    mutationFn: (appId: string) => unpublishApp(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminApps'] });
      setUnpublishTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (appId: string) => deleteApp(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminApps'] });
      setDeleteTarget(null);
      setDeleteConfirmText('');
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">All Apps</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : apps && apps.length > 0 ? (
        <div className="space-y-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {app.icon_url ? (
                    <img src={app.icon_url} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <span className="text-gray-400 text-lg">
                        {app.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <Link to={`/apps/${app.app_id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{app.name}</h3>
                      {app.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                          <Users className="w-3 h-3" />
                          Community
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${app.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                      >
                        {app.is_published ? 'Published' : 'Not Published'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{app.app_id}</p>
                  </Link>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {app.is_published && (
                    <button
                      onClick={() => setUnpublishTarget(app)}
                      className="inline-flex items-center gap-1.5 bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                    >
                      <EyeOff size={14} />
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteTarget(app); setDeleteConfirmText(''); }}
                    className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400">No apps registered.</p>
        </div>
      )}

      {unpublishTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unpublish {unpublishTarget.name}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will remove the app from the public listing. Users who already installed it
              will keep their copy but won't receive updates. The developer can re-publish by
              submitting a new version.
            </p>
            {unpublishMutation.isError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                {(unpublishMutation.error as Error).message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUnpublishTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => unpublishMutation.mutate(unpublishTarget.app_id)}
                disabled={unpublishMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This action is <strong>permanent and irreversible</strong>. It will:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 list-disc pl-5 space-y-1">
              <li>Delete the app and all its metadata</li>
              <li>Delete all submissions and reviews</li>
              <li>Delete the GitHub repository</li>
            </ul>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Type <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-xs">{deleteTarget.app_id}</code> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget.app_id}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            {deleteMutation.isError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                {(deleteMutation.error as Error).message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.app_id)}
                disabled={deleteConfirmText !== deleteTarget.app_id || deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

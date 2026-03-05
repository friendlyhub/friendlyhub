import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getApp } from '../api/client';

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();

  const { data: app, isLoading, error } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (error)
    return (
      <div className="text-center py-12 text-red-500">
        {(error as Error).message}
      </div>
    );
  if (!app) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 font-bold text-2xl shrink-0">
          {app.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{app.name}</h1>
          <p className="text-gray-500 mt-1">{app.summary}</p>
          <div className="flex items-center gap-3 mt-3">
            {app.is_verified && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                Verified
              </span>
            )}
            {app.license && (
              <span className="text-xs text-gray-500">{app.license}</span>
            )}
          </div>
        </div>
      </div>

      {/* Install */}
      <div className="bg-gray-900 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-3">Install</h2>
        <code className="block bg-gray-800 rounded-lg p-3 text-sm font-mono text-emerald-400">
          flatpak install friendlyhub {app.app_id}
        </code>
        <code className="block bg-gray-800 rounded-lg p-3 text-sm font-mono text-emerald-400 mt-2">
          flatpak run {app.app_id}
        </code>
      </div>

      {/* Description */}
      {app.description && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">About</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{app.description}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">App ID</dt>
            <dd className="font-mono text-gray-900">{app.app_id}</dd>
          </div>
          {app.categories.length > 0 && (
            <div>
              <dt className="text-gray-500">Categories</dt>
              <dd className="text-gray-900">{app.categories.join(', ')}</dd>
            </div>
          )}
          {app.homepage_url && (
            <div>
              <dt className="text-gray-500">Homepage</dt>
              <dd>
                <a
                  href={app.homepage_url}
                  className="text-emerald-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {app.homepage_url}
                </a>
              </dd>
            </div>
          )}
          {app.source_url && (
            <div>
              <dt className="text-gray-500">Source Code</dt>
              <dd>
                <a
                  href={app.source_url}
                  className="text-emerald-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {app.source_url}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

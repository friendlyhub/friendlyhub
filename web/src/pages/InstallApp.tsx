import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getApp } from '../api/client';
import { Download, ExternalLink } from 'lucide-react';
import { REPO_NAME, FLATPAKREPO_URL, flatpakrefUrl, flatpakInstallUrl } from '../config/repo';

export default function InstallApp() {
  const { appId } = useParams<{ appId: string }>();
  const triggered = useRef(false);

  const { data: app, isLoading } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  useEffect(() => {
    if (!appId || triggered.current) return;
    triggered.current = true;
    window.location.href = flatpakInstallUrl(appId);
  }, [appId]);

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;

  const displayName = app?.name || appId || 'App';

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* App header */}
      <div className="flex items-center gap-4 mb-8">
        {app?.icon_url ? (
          <img src={app.icon_url} alt="" className="w-16 h-16 rounded-xl" />
        ) : (
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl">
            {displayName.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Installing {displayName}</h1>
          {app?.summary && <p className="text-gray-500 dark:text-gray-400 text-sm">{app.summary}</p>}
        </div>
      </div>

      {/* Status */}
      <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Download size={24} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Opening your software manager...</h2>
        </div>
        <p className="text-emerald-700 dark:text-emerald-400 text-sm">
          {displayName} should now be opening in your software manager
          (e.g. GNOME Software, KDE Discover).
        </p>
        <p className="text-emerald-700 dark:text-emerald-400 text-sm mt-2">
          If nothing happened, try the options below.
        </p>
      </div>

      {/* Fallback instructions */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Having trouble? Here's what you can do:
        </h2>

        <div className="space-y-6">
          {/* Option 1: Direct download */}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">1. Download the .flatpakref</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <a
                href={flatpakrefUrl(appId!)}
                download={`${appId}.flatpakref`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Download the .flatpakref file
              </a>
              {' '}and double-click it to open in your software manager.
            </p>
          </div>

          {/* Option 2: Manual install */}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">2. Manual Install</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              You can install {displayName} via the command line:
            </p>
            <div className="space-y-2">
              <code className="block bg-gray-900 text-emerald-400 rounded-lg p-3 text-sm font-mono">
                flatpak remote-add --if-not-exists {REPO_NAME} {FLATPAKREPO_URL}
              </code>
              <code className="block bg-gray-900 text-emerald-400 rounded-lg p-3 text-sm font-mono">
                flatpak install {REPO_NAME} {appId}
              </code>
            </div>
          </div>

          {/* Option 3: Troubleshooting */}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">3. Troubleshooting</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If that still doesn't work, make sure you have Flatpak installed.{' '}
              <a
                href="https://flatpak.org/setup/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                See the setup guide
                <ExternalLink size={12} />
              </a>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Link
            to={`/apps/${appId}`}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Back to {displayName}
          </Link>
        </div>
      </div>
    </div>
  );
}

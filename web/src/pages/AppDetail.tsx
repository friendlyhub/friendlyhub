import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getApp, getAppsByOwner } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { Screenshot } from '../types';

// --- Permission classification ---
interface PermissionInfo {
  label: string;
  description: string;
  level: 'safe' | 'warning' | 'danger';
}

const PERMISSION_MAP: Record<string, PermissionInfo> = {
  '--share=network': { label: 'Network', description: 'Access the internet', level: 'safe' },
  '--share=ipc': { label: 'IPC', description: 'Inter-process communication (required for X11)', level: 'safe' },
  '--socket=x11': { label: 'X11', description: 'X11 windowing system', level: 'warning' },
  '--socket=fallback-x11': { label: 'X11 (fallback)', description: 'X11 only when Wayland unavailable', level: 'safe' },
  '--socket=wayland': { label: 'Wayland', description: 'Wayland windowing system', level: 'safe' },
  '--socket=pulseaudio': { label: 'Audio', description: 'Play and record audio', level: 'safe' },
  '--socket=system-bus': { label: 'System Bus', description: 'Full system D-Bus access', level: 'danger' },
  '--socket=session-bus': { label: 'Session Bus', description: 'Full session D-Bus access', level: 'warning' },
  '--device=dri': { label: 'GPU', description: 'GPU acceleration', level: 'safe' },
  '--device=all': { label: 'All Devices', description: 'Access to all hardware devices', level: 'danger' },
  '--filesystem=host': { label: 'Host Filesystem', description: 'Full read/write to your files', level: 'danger' },
  '--filesystem=home': { label: 'Home Directory', description: 'Read/write to your home folder', level: 'warning' },
  '--filesystem=/': { label: 'Root Filesystem', description: 'Full read/write to entire filesystem', level: 'danger' },
};

function classifyPermission(arg: string): PermissionInfo {
  // Exact match first
  if (PERMISSION_MAP[arg]) return PERMISSION_MAP[arg];
  // Prefix matches for filesystem
  if (arg.startsWith('--filesystem=xdg-')) {
    const dir = arg.replace('--filesystem=xdg-', '').replace(':ro', '').replace(':create', '');
    const readonly = arg.includes(':ro');
    return {
      label: `${dir} folder`,
      description: readonly ? `Read-only access to ${dir}` : `Read/write access to ${dir}`,
      level: readonly ? 'safe' : 'warning',
    };
  }
  if (arg.startsWith('--filesystem=')) {
    const path = arg.replace('--filesystem=', '');
    return { label: path, description: `Filesystem access: ${path}`, level: 'warning' };
  }
  if (arg.startsWith('--talk-name=')) {
    const name = arg.replace('--talk-name=', '');
    return { label: name, description: `D-Bus talk access to ${name}`, level: 'safe' };
  }
  if (arg.startsWith('--own-name=')) {
    const name = arg.replace('--own-name=', '');
    return { label: name, description: `Owns D-Bus name: ${name}`, level: 'safe' };
  }
  if (arg.startsWith('--env=')) {
    return { label: 'Environment', description: arg.replace('--env=', ''), level: 'safe' };
  }
  return { label: arg, description: arg, level: 'safe' };
}

const LEVEL_STYLES = {
  safe: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
};

const LEVEL_DOT = {
  safe: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

// --- License helpers ---
const OSS_LICENSES = [
  'GPL', 'LGPL', 'AGPL', 'MIT', 'BSD', 'Apache', 'MPL', 'ISC', 'Artistic',
  'CC-BY', 'CC0', 'Unlicense', 'Zlib', 'PSF', 'WTFPL', 'OFL',
];

function isOpenSource(license: string | null): boolean {
  if (!license) return false;
  return OSS_LICENSES.some((oss) => license.toUpperCase().includes(oss.toUpperCase()));
}

// --- Screenshots carousel ---
function ScreenshotCarousel({ screenshots }: { screenshots: Screenshot[] }) {
  const [idx, setIdx] = useState(0);
  if (screenshots.length === 0) return null;
  const current = screenshots[idx];

  return (
    <div className="mb-8">
      <div className="relative bg-gray-100 rounded-xl overflow-hidden">
        <img
          src={current.url}
          alt={current.caption || 'Screenshot'}
          className="w-full h-auto max-h-125 object-contain mx-auto"
        />
        {screenshots.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + screenshots.length) % screenshots.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              &#8249;
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % screenshots.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              &#8250;
            </button>
          </>
        )}
      </div>
      {current.caption && (
        <p className="text-sm text-gray-500 text-center mt-2">{current.caption}</p>
      )}
      {screenshots.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === idx ? 'bg-emerald-600' : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Other apps by developer ---
function OtherApps({ ownerId, currentAppId }: { ownerId: string; currentAppId: string }) {
  const { data: apps } = useQuery({
    queryKey: ['appsByOwner', ownerId],
    queryFn: () => getAppsByOwner(ownerId),
  });

  const others = apps?.filter((a) => a.app_id !== currentAppId) ?? [];
  if (others.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Other Apps by This Developer
      </h3>
      <div className="space-y-3">
        {others.map((a) => (
          <Link
            key={a.id}
            to={`/apps/${a.app_id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {a.icon_url ? (
              <img src={a.icon_url} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold text-sm">
                {a.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 text-sm">{a.name}</p>
              <p className="text-xs text-gray-500">{a.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const { user } = useAuthStore();
  const [infoTab, setInfoTab] = useState<'links' | 'details'>('links');

  const { data: app, isLoading, error } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{(error as Error).message}</div>;
  if (!app) return null;

  const finishArgs = app.finish_args ?? [];
  const license = app.project_license || app.license;
  const oss = isOpenSource(license);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {app.icon_url ? (
          <img src={app.icon_url} alt="" className="w-20 h-20 rounded-2xl shrink-0" />
        ) : (
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 font-bold text-2xl shrink-0">
            {app.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900 truncate">{app.name}</h1>
            {user && user.id === app.owner_id && (
              <Link
                to={`/my/apps/${app.app_id}/submit`}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0"
              >
                Submit Version
              </Link>
            )}
          </div>
          {app.developer_name && (
            <p className="text-gray-600 mt-1">by {app.developer_name}</p>
          )}
          <p className="text-gray-500 mt-1">{app.summary}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {app.is_verified && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                Verified
              </span>
            )}
            {app.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Screenshots */}
      <ScreenshotCarousel screenshots={app.screenshots ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Install */}
          <div className="bg-gray-900 rounded-xl p-6">
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
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
              <div
                className="text-gray-700 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: app.description }}
              />
            </div>
          )}

          {/* Changelog */}
          {app.releases && app.releases.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Changelog</h2>
              <div className="space-y-4">
                {app.releases.slice(0, 5).map((rel) => (
                  <div key={rel.version} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">v{rel.version}</span>
                      {rel.date && (
                        <span className="text-xs text-gray-500">{rel.date}</span>
                      )}
                    </div>
                    {rel.description && (
                      <div
                        className="text-sm text-gray-600 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0.5 [&_p]:mb-1"
                        dangerouslySetInnerHTML={{ __html: rel.description }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* License card */}
          {license && (
            <div
              className={`rounded-xl border p-5 ${
                oss
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{oss ? '\u{1F513}' : '\u{1F512}'}</span>
                <h3 className="font-semibold text-gray-900">
                  {oss ? 'Open Source' : 'Proprietary'}
                </h3>
              </div>
              <p className={`text-sm ${oss ? 'text-blue-700' : 'text-orange-700'}`}>
                {license}
              </p>
              <div className="flex gap-2 mt-3">
                {app.vcs_url && oss && (
                  <a
                    href={app.vcs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    View Source
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Permissions card */}
          {finishArgs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Permissions</h3>
              <div className="space-y-2">
                {finishArgs.map((arg: string) => {
                  const info = classifyPermission(arg);
                  return (
                    <div
                      key={arg}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${LEVEL_STYLES[info.level]}`}
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${LEVEL_DOT[info.level]}`} />
                      <div>
                        <span className="font-medium">{info.label}</span>
                        <p className="text-xs opacity-75">{info.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Safe</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Caution</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Danger</span>
              </div>
            </div>
          )}

          {/* Information card with tabs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setInfoTab('links')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  infoTab === 'links'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Links
              </button>
              <button
                onClick={() => setInfoTab('details')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  infoTab === 'details'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
            </div>

            {infoTab === 'links' && (
              <dl className="space-y-3 text-sm">
                {app.homepage_url && (
                  <div>
                    <dt className="text-gray-500 text-xs">Homepage</dt>
                    <dd>
                      <a href={app.homepage_url} className="text-emerald-600 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        {app.homepage_url.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {(app.vcs_url || app.source_url) && (
                  <div>
                    <dt className="text-gray-500 text-xs">Repository</dt>
                    <dd>
                      <a href={app.vcs_url || app.source_url!} className="text-emerald-600 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        {(app.vcs_url || app.source_url!).replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {app.bugtracker_url && (
                  <div>
                    <dt className="text-gray-500 text-xs">Bug Tracker</dt>
                    <dd>
                      <a href={app.bugtracker_url} className="text-emerald-600 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        {app.bugtracker_url.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {infoTab === 'details' && (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs">App ID</dt>
                  <dd className="font-mono text-gray-900 text-xs">{app.app_id}</dd>
                </div>
                {app.releases && app.releases.length > 0 && (
                  <div>
                    <dt className="text-gray-500 text-xs">Latest Version</dt>
                    <dd className="text-gray-900">v{app.releases[0].version}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 text-xs">Added</dt>
                  <dd className="text-gray-900">{new Date(app.created_at).toLocaleDateString()}</dd>
                </div>
              </dl>
            )}
          </div>

          {/* Other apps by developer */}
          <OtherApps ownerId={app.owner_id} currentAppId={app.app_id} />
        </div>
      </div>
    </div>
  );
}

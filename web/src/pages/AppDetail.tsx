import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getApp, getAppsByOwner, deleteApp, unpublishApp } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { resolveLicense } from '../utils/licenses';
import { formatDate } from '../utils/dates';
import {
  Unlock, Lock, Code, Scale, Terminal, Play, Shield, ShieldAlert, ShieldCheck, X, Download,
  ChevronLeft, ChevronRight,
  Monitor, Server, Mouse, Usb, MemoryStick, Wifi, ArrowLeftRight, AppWindow,
  Volume2, Printer, Key, Radio, Bluetooth, Share2, Plug, Cpu, FolderOpen,
  Database, ToggleRight, Settings, FileText, ShieldQuestion,
  Upload, Trash2, EyeOff, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { classifyPermission, getOverallSeverity, sortBySeverity, getPermissionIcon, SEVERITY_CONFIG } from '../utils/permissions';
import type { MatchResult } from '../utils/permissions';
import type { Screenshot } from '../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Monitor, Server, Mouse, Usb, MemoryStick, Wifi, ArrowLeftRight, AppWindow,
  Volume2, Printer, Key, Radio, Bluetooth, Share2, Plug, Cpu, FolderOpen,
  Database, ToggleRight, Settings, FileText, ShieldQuestion, Shield,
};

// --- Screenshots carousel ---
function ScreenshotCarousel({ screenshots }: { screenshots: Screenshot[] }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (screenshots.length === 0) return null;

  const go = (delta: number) =>
    setIdx((i) => (i + delta + screenshots.length) % screenshots.length);

  return (
    <>
      <div className="mb-8">
        <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {screenshots.map((s) => (
              <img
                key={s.url}
                src={s.url}
                alt={s.caption || 'Screenshot'}
                className="w-full shrink-0 h-auto max-h-125 object-contain cursor-pointer"
                onClick={() => setLightbox(true)}
              />
            ))}
          </div>
          {screenshots.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
        {screenshots[idx].caption && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">{screenshots[idx].caption}</p>
        )}
        {screenshots.length > 1 && (
          <div className="flex justify-center gap-2 mt-3">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === idx ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
          >
            <X size={28} />
          </button>
          <div className="w-full h-full overflow-hidden p-8" onClick={(e) => e.stopPropagation()}>
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${idx * 100}%)` }}
            >
              {screenshots.map((s) => (
                <div key={s.url} className="w-full h-full shrink-0 flex items-center justify-center">
                  <img
                    src={s.url}
                    alt={s.caption || 'Screenshot'}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
          {screenshots.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); go(1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {screenshots[idx].caption && (
            <p className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm">
              {screenshots[idx].caption}
            </p>
          )}
          {screenshots.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2">
              {screenshots.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === idx ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
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
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Other Apps by This Developer
      </h3>
      <div className="space-y-3">
        {others.map((a) => (
          <Link
            key={a.id}
            to={`/apps/${a.app_id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {a.icon_url ? (
              <img src={a.icon_url} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                {a.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{a.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{a.summary}</p>
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [installTab, setInstallTab] = useState<'install' | 'run'>('install');
  const [infoTab, setInfoTab] = useState<'links' | 'details'>('links');
  const [showUnpublish, setShowUnpublish] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showPermDetails, setShowPermDetails] = useState(false);

  const { data: app, isLoading, error } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishApp(app!.app_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', appId] });
      setShowUnpublish(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteApp(app!.app_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myApps'] });
      queryClient.invalidateQueries({ queryKey: ['adminApps'] });
      navigate(isAdmin && !isOwner ? '/admin/apps' : '/my/apps');
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="text-center py-12 text-red-500 dark:text-red-400">{(error as Error).message}</div>;
  if (!app) return null;

  const isOwner = user && user.id === app.owner_id;
  const isAdmin = user && user.role === 'admin';
  const canManage = isOwner || isAdmin;
  const finishArgs = app.finish_args ?? [];
  const classified = finishArgs.map(classifyPermission);
  const overallSeverity = finishArgs.length > 0 ? getOverallSeverity(classified) : 'safe';
  const license = app.project_license || app.license;
  const licenseInfo = resolveLicense(license);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Management panel */}
      {canManage && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Info size={16} />
              <span className="font-medium">{isOwner ? 'You own this app.' : 'Admin access.'}</span>
              {!app.is_published && (
                <span className="text-blue-600 dark:text-blue-400">This page is a preview and is not publicly visible.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <Link
                  to={`/my/apps/${app.app_id}/submit`}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Upload size={14} />
                  Submit Version
                </Link>
              )}
              {app.is_published && (
                <button
                  onClick={() => setShowUnpublish(true)}
                  className="inline-flex items-center gap-1.5 bg-yellow-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  <EyeOff size={14} />
                  Unpublish
                </button>
              )}
              <button
                onClick={() => { setShowDelete(true); setDeleteConfirmText(''); }}
                className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        {app.icon_url ? (
          <img src={app.icon_url} alt="" className="w-20 h-20 rounded-2xl shrink-0" />
        ) : (
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-2xl shrink-0">
            {app.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">{app.name}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/apps/${app.app_id}/install`}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
                  { safe: 'bg-green-600 hover:bg-green-700', caution: 'bg-amber-500 hover:bg-amber-600', sensitive: 'bg-orange-500 hover:bg-orange-600' }[overallSeverity]
                }`}
              >
                <Download size={16} />
                Install
              </Link>
            </div>
          </div>
          {app.developer_name && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">by {app.developer_name}</p>
          )}
          <p className="text-gray-500 dark:text-gray-400 mt-1">{app.summary}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {app.is_verified && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                Verified
              </span>
            )}
            {app.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
              >
                {cat}
              </span>
            ))}
            {app.keywords.map((kw) => (
              <span
                key={kw}
                className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Screenshots */}
      <ScreenshotCarousel screenshots={app.screenshots ?? []} />

      {/* Install + License row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-xl p-6 h-full flex flex-col">
            <div className="flex border-b border-gray-700 mb-3">
              <button
                onClick={() => setInstallTab('install')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  installTab === 'install'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Terminal size={14} />
                Install
              </button>
              <button
                onClick={() => setInstallTab('run')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  installTab === 'run'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Play size={14} />
                Run
              </button>
            </div>
            <div className="flex-1 flex items-center">
              <code className="block w-full bg-gray-800 rounded-lg p-3 text-sm font-mono text-emerald-400">
                {installTab === 'install'
                  ? `flatpak install friendlyhub ${app.app_id}`
                  : `flatpak run ${app.app_id}`}
              </code>
            </div>
          </div>
        </div>
        {license && (
          <div>
            <div
              className={`rounded-xl border p-5 h-full flex flex-col ${
                licenseInfo.isOpenSource
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {licenseInfo.isOpenSource ? (
                  <Unlock size={20} className="text-blue-600 dark:text-blue-400" />
                ) : (
                  <Lock size={20} className="text-orange-600 dark:text-orange-400" />
                )}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {licenseInfo.isOpenSource ? 'Open Source' : 'Proprietary'}
                </h3>
              </div>
              <p className={`text-sm ${licenseInfo.isOpenSource ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                {licenseInfo.name}
              </p>
              <div className="flex gap-2 mt-auto pt-3">
                {app.vcs_url && licenseInfo.isOpenSource && (
                  <a
                    href={app.vcs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <Code size={14} />
                    View Source
                  </a>
                )}
                {licenseInfo.url && (
                  <a
                    href={licenseInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <Scale size={14} />
                    View License
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {app.description && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">About</h2>
              <div
                className="text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: app.description }}
              />
            </div>
          )}

          {/* Changelog */}
          {app.releases && app.releases.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Changelog</h2>
              <div className="space-y-4">
                {app.releases.slice(0, 5).map((rel) => (
                  <div key={rel.version} className="border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">v{rel.version}</span>
                      {rel.date && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{rel.date}</span>
                      )}
                    </div>
                    {rel.description && (
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0.5 [&_p]:mb-1"
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
          {/* Permissions card */}
          {finishArgs.length > 0 && (() => {
            const config = SEVERITY_CONFIG[overallSeverity];
            const sorted = sortBySeverity(classified);
            const ShieldIcon = overallSeverity === 'safe' ? ShieldCheck : overallSeverity === 'caution' ? Shield : ShieldAlert;
            const summaryItems = sorted.slice(0, 3).map((r) =>
              r.description.replace(/\.$/, '').replace(/^Allows the app to /, '')
            );
            const summaryText = summaryItems.join(', ') +
              (sorted.length > 3 ? `, and ${sorted.length - 3} more` : '');

            return (
              <div className={`rounded-xl border p-5 ${config.bg} ${config.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldIcon size={20} className={config.color} />
                  <span className={`font-semibold ${config.color}`}>{config.label}</span>
                </div>
                <p className={`text-sm ${config.color} opacity-80 mb-2`}>{config.summary}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{summaryText}</p>
                <button
                  onClick={() => setShowPermDetails(true)}
                  className={`mt-3 text-xs font-medium ${config.color} hover:opacity-80 transition-opacity`}
                >
                  Show details
                </button>
              </div>
            );
          })()}

          {/* Information card with tabs */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
              <button
                onClick={() => setInfoTab('links')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  infoTab === 'links'
                    ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Links
              </button>
              <button
                onClick={() => setInfoTab('details')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  infoTab === 'details'
                    ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Details
              </button>
            </div>

            {infoTab === 'links' && (
              <dl className="space-y-3 text-sm">
                {app.homepage_url && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Homepage</dt>
                    <dd>
                      <a href={app.homepage_url} className="text-emerald-600 dark:text-emerald-400 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        {app.homepage_url.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {(app.vcs_url || app.source_url) && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Repository</dt>
                    <dd>
                      <a href={app.vcs_url || app.source_url!} className="text-emerald-600 dark:text-emerald-400 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                        {(app.vcs_url || app.source_url!).replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                )}
                {app.bugtracker_url && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Bug Tracker</dt>
                    <dd>
                      <a href={app.bugtracker_url} className="text-emerald-600 dark:text-emerald-400 hover:underline break-all" target="_blank" rel="noopener noreferrer">
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
                  <dd className="font-mono text-gray-900 dark:text-gray-100 text-xs">{app.app_id}</dd>
                </div>
                {app.releases && app.releases.length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Latest Version</dt>
                    <dd className="text-gray-900 dark:text-gray-100">v{app.releases[0].version}</dd>
                  </div>
                )}
                {app.download_size && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Download Size</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatSize(app.download_size)}</dd>
                  </div>
                )}
                {app.installed_size && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Installed Size</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatSize(app.installed_size)}</dd>
                  </div>
                )}
                {app.install_count > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Installs</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{app.install_count.toLocaleString()}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 text-xs">Added</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(app.created_at)}</dd>
                </div>
                {app.updated_at && app.updated_at !== app.created_at && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400 text-xs">Last Updated</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatDate(app.updated_at)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Other apps by developer */}
          <OtherApps ownerId={app.owner_id} currentAppId={app.app_id} />
        </div>
      </div>

      {/* Permissions detail modal */}
      {showPermDetails && (() => {
        const config = SEVERITY_CONFIG[overallSeverity];
        const sorted = sortBySeverity(classified);
        const ShieldIcon = overallSeverity === 'safe' ? ShieldCheck : overallSeverity === 'caution' ? Shield : ShieldAlert;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPermDetails(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between p-5 border-b ${config.border} ${config.bg} rounded-t-xl`}>
                <div className="flex items-center gap-2">
                  <ShieldIcon size={22} className={config.color} />
                  <h3 className={`text-lg font-semibold ${config.color}`}>{config.label}</h3>
                </div>
                <button onClick={() => setShowPermDetails(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={20} />
                </button>
              </div>
              <p className={`text-sm px-5 pt-4 pb-2 ${config.color} opacity-80`}>{config.summary}</p>
              <div className="overflow-y-auto px-5 pb-5 space-y-2">
                {sorted.map((r: MatchResult) => {
                  const rc = SEVERITY_CONFIG[r.severity];
                  const iconName = getPermissionIcon(r);
                  const IconComponent = ICON_MAP[iconName] || Shield;

                  return (
                    <div
                      key={r.permission}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${rc.bg} ${rc.border}`}
                    >
                      <IconComponent size={18} className={`shrink-0 mt-0.5 ${rc.color}`} />
                      <div className="min-w-0">
                        <p className={`font-medium text-sm ${rc.color}`}>{r.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{r.permission}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Safe</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Caution</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Sensitive</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Unpublish confirmation modal */}
      {showUnpublish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unpublish {app.name}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will remove the app from the public listing. Users who already installed it
              will keep their copy but won't receive updates. You can re-publish by submitting
              a new version.
            </p>
            {unpublishMutation.isError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                {(unpublishMutation.error as Error).message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUnpublish(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Delete {app.name}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This action is <strong>permanent and irreversible</strong>. It will:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 list-disc pl-5 space-y-1">
              <li>Delete the app and all its metadata</li>
              <li>Delete all submissions and reviews</li>
              <li>Delete the GitHub repository</li>
            </ul>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Type <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-xs">{app.app_id}</code> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={app.app_id}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            {deleteMutation.isError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                {(deleteMutation.error as Error).message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteConfirmText !== app.app_id || deleteMutation.isPending}
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

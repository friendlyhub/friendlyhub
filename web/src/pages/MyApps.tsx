import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Users, MoreVertical,
  FileText, Upload, ShieldAlert,
} from 'lucide-react';
import { getMyApps } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import type { MyAppInfo } from '../types';

function ActionsMenu({ app }: { app: MyAppInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasSubmission = !!app.latest_submission_id;

  const items: { to: string; label: string; icon: typeof FileText; show: boolean }[] = [
    {
      to: `/my/submissions/${app.latest_submission_id}`,
      label: 'View Submission',
      icon: FileText,
      show: hasSubmission,
    },
    {
      to: `/my/apps/${app.app_id}/submit`,
      label: 'Submit Version',
      icon: Upload,
      show: app.is_verified,
    },
    {
      to: `/my/apps/${app.app_id}/verify`,
      label: 'Verify Domain',
      icon: ShieldAlert,
      show: !app.is_verified && app.developer_type === 'original',
    },
  ];

  const visibleItems = items.filter((i) => i.show);
  if (visibleItems.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
          {visibleItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <item.icon className="w-4 h-4 text-gray-400" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyApps() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ['myApps'],
    queryFn: getMyApps,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Apps</h1>
        <Link
          to="/my/apps/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Register New App
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : apps && apps.length > 0 ? (
        <div className="space-y-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {app.icon_url ? (
                    <img src={app.icon_url} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-gray-400 text-lg">
                        {app.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <Link to={`/apps/${app.app_id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{app.name}</h3>
                      {app.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          <Users className="w-3 h-3" />
                          Community
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${app.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {app.is_published ? 'Published' : 'Not Published'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {app.latest_submission_version ? (
                        <>
                          Latest submission: v{app.latest_submission_version}{' '}
                          <StatusBadge status={app.latest_submission_status!} />
                        </>
                      ) : (
                        <span className="text-gray-400">No submissions yet</span>
                      )}
                      {app.releases.length > 0 && (
                        <span className="ml-3">
                          Published: v{app.releases[0].version}
                        </span>
                      )}
                    </p>
                  </Link>
                </div>
                <div className="shrink-0 ml-2">
                  <ActionsMenu app={app} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">You haven't registered any apps yet.</p>
          <Link
            to="/my/apps/new"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Register your first app &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

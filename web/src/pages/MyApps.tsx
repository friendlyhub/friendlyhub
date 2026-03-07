import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users } from 'lucide-react';
import { getMyApps } from '../api/client';

export default function MyApps() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ['myApps'],
    queryFn: getMyApps,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Apps</h1>
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
                <div className="flex items-center gap-3 flex-1">
                  {app.icon_url ? (
                    <img src={app.icon_url} alt="" className="w-10 h-10 rounded-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-lg">
                        {app.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <Link to={`/apps/${app.app_id}`} className="flex-1">
                    <div className="flex items-center gap-2">
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
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{app.app_id}</p>
                    {app.releases.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">v{app.releases[0].version}</p>
                    )}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  {!app.is_verified && app.developer_type === 'original' && (
                    <Link
                      to={`/my/apps/${app.app_id}/verify`}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Verify
                    </Link>
                  )}
                  {app.is_verified && (
                    <Link
                      to={`/my/apps/${app.app_id}/submit`}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Submit Version
                    </Link>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${app.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {app.is_published ? 'Published' : 'Not Published'}
                  </span>
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

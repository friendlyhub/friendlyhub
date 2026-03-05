import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
            <Link
              key={app.id}
              to={`/apps/${app.app_id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{app.name}</h3>
                  <p className="text-sm text-gray-500 font-mono">{app.app_id}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${app.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {app.is_published ? 'Published' : 'Not Published'}
                </span>
              </div>
            </Link>
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

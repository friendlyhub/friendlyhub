import { Link } from 'react-router-dom';
import type { App } from '../types';

export default function AppCard({ app }: { app: App }) {
  return (
    <Link
      to={`/apps/${app.app_id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start gap-4">
        {app.icon_url ? (
          <img src={app.icon_url} alt="" className="w-14 h-14 rounded-xl shrink-0" />
        ) : (
          <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-lg shrink-0">
            {app.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{app.summary}</p>
          {app.categories.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {app.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

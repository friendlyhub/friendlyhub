import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getReviewQueue } from '../api/client';
import { formatDate } from '../utils/dates';
import StatusBadge from '../components/StatusBadge';

export default function ReviewQueue() {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: getReviewQueue,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Review Queue</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <Link
              key={sub.id}
              to={`/review/${sub.id}`}
              className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{sub.app_id}</span>
                  <span className="text-gray-400 mx-2">&middot;</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">v{sub.version}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(sub.created_at)}
                  </span>
                  <StatusBadge status={sub.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400">No submissions awaiting review.</p>
        </div>
      )}
    </div>
  );
}

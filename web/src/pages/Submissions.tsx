import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMySubmissions } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function Submissions() {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['mySubmissions'],
    queryFn: getMySubmissions,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Submissions</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : submissions && submissions.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Version</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-4 py-3 font-mono">{sub.version}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/my/submissions/${sub.id}`}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      View
                    </Link>
                    {sub.build_log_url && (
                      <a
                        href={sub.build_log_url}
                        className="text-emerald-600 hover:text-emerald-700 ml-3"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Build Log
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No submissions yet.</p>
        </div>
      )}
    </div>
  );
}

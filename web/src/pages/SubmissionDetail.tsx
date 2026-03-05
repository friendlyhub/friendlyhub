import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getSubmission, getSubmissionChecks } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: sub, isLoading } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => getSubmission(id!),
    enabled: !!id,
  });

  const { data: checks } = useQuery({
    queryKey: ['submission-checks', id],
    queryFn: () => getSubmissionChecks(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!sub) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Submission {sub.version}
        </h1>
        <StatusBadge status={sub.status} />
      </div>

      <div className="space-y-6">
        {/* Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Submission ID</dt>
              <dd className="font-mono text-gray-900 text-xs">{sub.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Submitted</dt>
              <dd className="text-gray-900">
                {new Date(sub.created_at).toLocaleString()}
              </dd>
            </div>
            {sub.build_log_url && (
              <div>
                <dt className="text-gray-500">Build Log</dt>
                <dd>
                  <a
                    href={sub.build_log_url}
                    className="text-emerald-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on GitHub
                  </a>
                </dd>
              </div>
            )}
            {sub.fm_build_id && (
              <div>
                <dt className="text-gray-500">flat-manager Build</dt>
                <dd className="font-mono text-gray-900">#{sub.fm_build_id}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Checks */}
        {checks && checks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Automated Checks
            </h2>
            <div className="space-y-3">
              {checks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {check.check_name.replace(/_/g, ' ')}
                    </span>
                    {check.message && (
                      <p className="text-sm text-gray-500 mt-0.5">{check.message}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      check.status === 'passed'
                        ? 'bg-green-100 text-green-700'
                        : check.status === 'warning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manifest */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manifest</h2>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            {JSON.stringify(sub.manifest, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

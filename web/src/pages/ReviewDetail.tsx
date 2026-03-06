import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getReviewDetail, submitReviewDecision } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reviewDetail', id],
    queryFn: () => getReviewDetail(id!),
    enabled: !!id,
  });

  const decision = useMutation({
    mutationFn: ({ dec, cmt }: { dec: string; cmt: string }) =>
      submitReviewDecision(id!, dec, cmt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      navigate('/review');
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!data) return null;

  const { submission: sub, reviews, checks, app: appInfo } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Review: {appInfo?.name ?? 'Unknown App'} v{sub.version}
        </h1>
        <StatusBadge status={sub.status} />
      </div>
      {appInfo && (
        <p className="text-sm text-gray-500 mb-6 font-mono">{appInfo.app_id}</p>
      )}

      <div className="space-y-6">
        {/* Automated Checks */}
        {checks.length > 0 && (
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
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96">
            {JSON.stringify(sub.manifest, null, 2)}
          </pre>
        </div>

        {/* Previous reviews */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Previous Reviews
            </h2>
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={rev.decision} />
                    <span className="text-xs text-gray-500">
                      {new Date(rev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision form */}
        {sub.status === 'pending_review' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Decision</h2>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Leave a comment for the developer..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
            />

            {decision.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
                {(decision.error as Error).message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  decision.mutate({
                    dec: 'approved',
                    cmt: comment || 'Looks good!',
                  })
                }
                disabled={decision.isPending}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & Publish
              </button>
              <button
                onClick={() => {
                  if (!comment.trim()) {
                    alert('Please provide feedback when requesting changes.');
                    return;
                  }
                  decision.mutate({ dec: 'changes_requested', cmt: comment });
                }}
                disabled={decision.isPending}
                className="border border-orange-300 text-orange-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 disabled:opacity-50"
              >
                Request Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

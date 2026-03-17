import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, MessageSquare, ExternalLink, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('yaml', yaml);
import { formatDate } from '../utils/dates';
import {
  getSubmission, getSubmissionSourceFiles,
  getReviewDetail, getReviewSourceFiles,
  submitReviewDecision,
} from '../api/client';
import StatusBadge from '../components/StatusBadge';
import AutomatedChecks from '../components/AutomatedChecks';
import SubmissionCards from '../components/SubmissionCards';
import MarkdownToolbar from '../components/MarkdownToolbar';
import BuildProgress from '../components/BuildProgress';

interface Props {
  reviewMode?: boolean;
}

export default function SubmissionDetail({ reviewMode = false }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const decisionRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: [reviewMode ? 'reviewDetail' : 'submission', id],
    queryFn: () => reviewMode ? getReviewDetail(id!) : getSubmission(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.submission?.status;
      return status === 'building' || status === 'pending_build' ? 10_000 : false;
    },
  });

  const { data: sourceFiles } = useQuery({
    queryKey: [reviewMode ? 'reviewSourceFiles' : 'submissionSourceFiles', id],
    queryFn: () => reviewMode ? getReviewSourceFiles(id!) : getSubmissionSourceFiles(id!),
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

  const handleQuote = useCallback((filename: string, text: string, startLine: number, endLine: number) => {
    const lang = filename.endsWith('.json') ? 'json' : filename.endsWith('.xml') ? 'xml' : filename.endsWith('.sh') ? 'bash' : '';
    const lineRef = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
    const block = `**${filename}:${lineRef}**\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    setComment((prev) => prev + (prev && !prev.endsWith('\n') ? '\n' : '') + block);
    requestAnimationFrame(() => {
      decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      commentRef.current?.focus();
    });
  }, []);

  const mdComponents: import('react-markdown').Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      if (!match) {
        return <code className={className} {...props}>{children}</code>;
      }
      return (
        <SyntaxHighlighter style={githubGist} language={match[1]} PreTag="div">
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    },
  };

  if (isLoading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
  if (!data) return null;

  const { submission: sub, reviews, checks, app: appInfo } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {reviewMode ? `Review: ${appInfo?.name ?? 'Unknown App'} ` : 'Submission '}v{sub.version}
      </h1>
      {appInfo && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-mono">{appInfo.app_id}</p>
      )}
      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={sub.status} />
        {!sub.builds && sub.build_log_url && (
          <a
            href={sub.build_log_url}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4" />
            Build Log
          </a>
        )}
      </div>

      {/* Review Decision */}
      {reviews.length > 0 && (
        <div className={`rounded-xl border p-6 mb-6 ${
          reviews[reviews.length - 1].decision === 'approved'
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
            : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
        }`}>
          {reviews.map((rev) => {
            const isApproved = rev.decision === 'approved';
            return (
              <div key={rev.id} className={reviews.length > 1 ? 'mb-4 last:mb-0' : ''}>
                <div className="flex items-center gap-3 mb-2">
                  {isApproved ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                  )}
                  <h2 className={`text-lg font-semibold ${isApproved ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    {isApproved ? 'Approved' : 'Changes Requested'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {rev.reviewer_avatar_url && (
                    <img
                      src={rev.reviewer_avatar_url}
                      alt={rev.reviewer_name || 'Reviewer'}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span className={`text-sm font-medium ${isApproved ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {rev.reviewer_name || 'Reviewer'}
                  </span>
                  <span className={`text-sm ${isApproved ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatDate(rev.created_at)}
                  </span>
                </div>
                {rev.comment && (
                  <div className={`text-sm prose prose-sm max-w-none ${isApproved ? 'prose-green dark:prose-invert' : 'prose-orange dark:prose-invert'}`}>
                    <ReactMarkdown components={mdComponents}>{rev.comment}</ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-6">
        {/* Info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Submission ID</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100 text-xs">{sub.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Submitted</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {formatDate(sub.created_at)}
              </dd>
            </div>
            {!sub.builds && sub.fm_build_id && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">flat-manager Build</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">#{sub.fm_build_id}</dd>
              </div>
            )}
          </dl>
        </div>

        {sub.builds ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(sub.builds).map(([arch, build]) => (
              <div key={arch} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{arch}</h3>
                  <StatusBadge status={build.status} />
                  {build.build_log_url && (
                    <a
                      href={build.build_log_url}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Build Log
                    </a>
                  )}
                </div>
                {build.gha_run_id && appInfo?.app_id && (
                  <BuildProgress
                    appId={appInfo.app_id}
                    runId={build.gha_run_id}
                    runUrl={build.gha_run_url}
                    isBuilding={build.status === 'building' || build.status === 'pending'}
                  />
                )}
                {build.fm_build_id && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    flat-manager build #{build.fm_build_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : sub.gha_run_id && appInfo?.app_id ? (
          <BuildProgress
            appId={appInfo.app_id}
            runId={sub.gha_run_id}
            runUrl={sub.gha_run_url}
            isBuilding={sub.status === 'building' || sub.status === 'pending_build'}
          />
        ) : null}

        <AutomatedChecks checks={checks} />
        <SubmissionCards
          submission={sub}
          sourceFiles={sourceFiles}
          onQuote={reviewMode && sub.status === 'pending_review' ? handleQuote : undefined}
        />

        {/* Decision form (reviewer only) */}
        {reviewMode && sub.status === 'pending_review' && (
          <div ref={decisionRef} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Decision</h2>
              {comment.trim() && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              )}
            </div>

            {showPreview ? (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4 min-h-30 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown components={mdComponents}>{comment}</ReactMarkdown>
              </div>
            ) : (
              <>
                <MarkdownToolbar
                  textareaRef={commentRef}
                  value={comment}
                  onChange={setComment}
                />
                <textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={6}
                  placeholder="Leave a comment for the developer... Select text in the files above and click Quote to reference specific lines."
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 border-t-0 rounded-b-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4 font-mono"
                />
              </>
            )}

            {decision.isError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 mb-4">
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
                className="border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-50"
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

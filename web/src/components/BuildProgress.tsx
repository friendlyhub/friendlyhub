import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2, Circle, ExternalLink, Hammer } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';

interface GitHubStep {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface GitHubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: GitHubStep[];
}

interface GitHubJobsResponse {
  total_count: number;
  jobs: GitHubJob[];
}

async function fetchGitHubJobs(appId: string, runId: number): Promise<GitHubJobsResponse> {
  const res = await fetch(`/api/v1/apps/${appId}/build-progress/${runId}`);
  if (!res.ok) throw new Error(`Build progress API ${res.status}`);
  return res.json();
}

function StepIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'completed' && conclusion === 'success') {
    return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
  }
  if (status === 'completed' && conclusion === 'failure') {
    return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  }
  if (status === 'completed' && conclusion === 'skipped') {
    return <Circle className="w-4 h-4 text-gray-300 shrink-0" />;
  }
  if (status === 'in_progress') {
    return <Loader2 className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />;
  }
  return <Circle className="w-4 h-4 text-gray-300 shrink-0" />;
}

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.floor((e - s) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

interface Props {
  appId: string;
  runId: number;
  runUrl?: string | null;
  isBuilding: boolean;
}

export default function BuildProgress({ appId, runId, runUrl, isBuilding }: Props) {
  // Tick every second while building so formatDuration re-calculates with fresh Date.now()
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isBuilding) return;
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, [isBuilding]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ghaBuildProgress', appId, runId],
    queryFn: () => fetchGitHubJobs(appId, runId),
    refetchInterval: isBuilding ? 10_000 : false,
    staleTime: isBuilding ? 5_000 : 60_000,
  });

  // When build finishes (isBuilding flips false), do one final refetch so the
  // card shows completed steps instead of staying stuck on "Building Flatpak".
  const wasBuilding = useRef(isBuilding);
  useEffect(() => {
    if (wasBuilding.current && !isBuilding) {
      refetch();
    }
    wasBuilding.current = isBuilding;
  }, [isBuilding, refetch]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading build progress...
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const title = isBuilding ? 'Build Progress' : 'Build Log';
  const icon = isBuilding
    ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    : <Hammer className="w-5 h-5 text-gray-400" />;

  return (
    <CollapsibleCard title={title} icon={icon} defaultOpen={isBuilding} headerRight={
      runUrl ? (
        <a
          href={runUrl}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in GitHub
        </a>
      ) : undefined
    }>
      <div className="p-6 space-y-4">
        {data.jobs.map((job) => (
          <div key={job.id}>
            <div className="flex items-center gap-2 mb-3">
              <StepIcon status={job.status} conclusion={job.conclusion} />
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{job.name}</span>
              {job.started_at && (
                <span className="text-xs text-gray-400 ml-auto">
                  {formatDuration(job.started_at, job.completed_at)}
                </span>
              )}
            </div>
            <div className="ml-6 space-y-1.5">
              {job.steps
                .filter((s) => !s.name.startsWith('Set up job') && !s.name.startsWith('Complete job') && s.conclusion !== 'skipped')
                .map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <StepIcon status={step.status} conclusion={step.conclusion} />
                    <span className={`text-sm ${
                      step.status === 'in_progress' ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {step.name}
                    </span>
                    {step.started_at && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {formatDuration(step.started_at, step.completed_at)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}

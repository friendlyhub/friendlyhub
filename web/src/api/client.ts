import type { App, CheckResult, ReviewDetail, Submission, User } from '../types';

const API_BASE = '/api/v1';

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Auth
export const getMe = () => request<User>('/auth/me');

// Apps (public)
export const listApps = (q?: string, limit = 50, offset = 0) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request<App[]>(`/apps?${params}`);
};

export const getApp = (appId: string) => request<App>(`/apps/${appId}`);

// Apps (authenticated)
export const getMyApps = () => request<App[]>('/apps/mine');

export const createApp = (data: {
  app_id: string;
  name: string;
  summary: string;
  description?: string;
  categories?: string[];
  homepage_url?: string;
  source_url?: string;
  license?: string;
}) =>
  request<App>('/apps', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateApp = (
  appId: string,
  data: Partial<{
    name: string;
    summary: string;
    description: string;
    categories: string[];
    homepage_url: string;
    source_url: string;
    license: string;
  }>,
) =>
  request<App>(`/apps/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Submissions
export const submitApp = (
  appId: string,
  version: string,
  manifest: unknown,
  sourceFiles?: Record<string, string>,
) =>
  request<{ id: string; status: string; version: string; warnings: string[] }>(
    `/apps/${appId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        version,
        manifest,
        ...(sourceFiles && Object.keys(sourceFiles).length > 0
          ? { source_files: sourceFiles }
          : {}),
      }),
    },
  );

export const getMySubmissions = () => request<Submission[]>('/submissions');

export const getSubmission = (id: string) => request<Submission>(`/submissions/${id}`);

export const getSubmissionChecks = (id: string) =>
  request<CheckResult[]>(`/submissions/${id}/validate`);

// Review (reviewer only)
export const getReviewQueue = () => request<Submission[]>('/review/queue');

export const getReviewDetail = (id: string) =>
  request<ReviewDetail>(`/review/queue/${id}`);

export const submitReviewDecision = (id: string, decision: string, comment: string) =>
  request<{ review: unknown; submission_status: string }>(
    `/review/queue/${id}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    },
  );

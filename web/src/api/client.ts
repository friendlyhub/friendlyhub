import type { App, CheckResult, CreateAppResponse, MyAppInfo, ReviewDetail, Submission, SubmissionDetail, User } from '../types';

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

export const getAppsByOwner = (ownerId: string) =>
  request<App[]>(`/apps/by-owner/${ownerId}`);

// Apps (authenticated)
export const getMyApps = () => request<MyAppInfo[]>('/apps/mine');

export const createApp = (data: {
  app_id: string;
  developer_type: string;
  original_app_id?: string;
}) =>
  request<CreateAppResponse>('/apps', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const verifyDomain = (appId: string) =>
  request<{ status: string; message?: string; token?: string }>(`/apps/${appId}/verify`, {
    method: 'POST',
  });

export const checkDomainStatus = (domain: string) =>
  request<{ domain: string; verified: boolean; token: string | null; well_known_url?: string }>(
    '/apps/verification/check-domain',
    {
      method: 'POST',
      body: JSON.stringify({ domain }),
    },
  );

export const updateApp = (
  appId: string,
  data: Partial<{
    name: string;
    summary: string;
    description: string;
    homepage_url: string;
    source_url: string;
    license: string;
  }>,
) =>
  request<App>(`/apps/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteApp = (appId: string) =>
  request<{ status: string }>(`/apps/${appId}`, { method: 'DELETE' });

export const unpublishApp = (appId: string) =>
  request<{ status: string }>(`/apps/${appId}/unpublish`, { method: 'POST' });

// Submissions
export const submitApp = (
  appId: string,
  version: string,
  manifest: unknown,
  metainfo: string,
  sourceFiles?: Record<string, string>,
) =>
  request<{ id: string; status: string; version: string; warnings: string[] }>(
    `/apps/${appId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        version,
        manifest,
        metainfo,
        ...(sourceFiles && Object.keys(sourceFiles).length > 0
          ? { source_files: sourceFiles }
          : {}),
      }),
    },
  );

export const getSubmission = (id: string) => request<SubmissionDetail>(`/submissions/${id}`);

export const getSubmissionChecks = (id: string) =>
  request<CheckResult[]>(`/submissions/${id}/validate`);

export const getSubmissionSourceFiles = (id: string) =>
  request<SourceFileInfo[]>(`/submissions/${id}/source-files`);

// Review (reviewer only)
export const getReviewQueue = () => request<Submission[]>('/review/queue');

export const getReviewDetail = (id: string) =>
  request<ReviewDetail>(`/review/queue/${id}`);

export interface SourceFileInfo {
  name: string;
  download_url: string;
}

export const getReviewSourceFiles = (id: string) =>
  request<SourceFileInfo[]>(`/review/queue/${id}/source-files`);

export const submitReviewDecision = (id: string, decision: string, comment: string) =>
  request<{ review: unknown; submission_status: string }>(
    `/review/queue/${id}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    },
  );

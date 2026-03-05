export interface User {
  id: string;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

export interface App {
  id: string;
  app_id: string;
  owner_id: string;
  name: string;
  summary: string;
  description: string;
  categories: string[];
  homepage_url: string | null;
  source_url: string | null;
  license: string | null;
  is_published: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  app_id: string;
  submitter_id: string;
  version: string;
  manifest: Record<string, unknown>;
  source_ref: string | null;
  status: string;
  gha_run_id: number | null;
  gha_run_url: string | null;
  fm_build_id: number | null;
  build_log_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckResult {
  check_name: string;
  status: string;
  message: string | null;
  details: Record<string, unknown> | null;
}

export interface Review {
  id: string;
  submission_id: string;
  reviewer_id: string;
  decision: string;
  comment: string;
  created_at: string;
}

export interface ReviewDetail {
  submission: Submission;
  reviews: Review[];
  checks: CheckResult[];
}

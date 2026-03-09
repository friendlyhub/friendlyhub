export interface User {
  id: string;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  created_at?: string;
}

export interface Screenshot {
  url: string;
  caption: string | null;
  is_default: boolean;
}

export interface Release {
  version: string;
  date: string | null;
  description: string | null;
}

export interface Branding {
  light_color: string | null;
  dark_color: string | null;
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
  developer_name: string | null;
  icon_url: string | null;
  bugtracker_url: string | null;
  vcs_url: string | null;
  screenshots: Screenshot[];
  releases: Release[];
  branding: Branding | null;
  project_license: string | null;
  keywords: string[];
  finish_args: string[];
  download_size: number | null;
  installed_size: number | null;
  install_count: number;
  is_published: boolean;
  is_verified: boolean;
  developer_type: string | null;
  original_app_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationInfo {
  status: string;
  domain: string | null;
  token: string | null;
  well_known_url: string | null;
}

export interface CreateAppResponse extends App {
  verification: VerificationInfo | null;
}

export interface Submission {
  id: string;
  app_id: string;
  submitter_id: string;
  version: string;
  manifest: Record<string, unknown>;
  metainfo: string | null;
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
  reviewer_name?: string;
  reviewer_avatar_url?: string | null;
}

export interface MyAppInfo extends App {
  latest_submission_id?: string;
  latest_submission_version?: string;
  latest_submission_status?: string;
}

export interface SubmissionDetail {
  submission: Submission;
  reviews: Review[];
  checks: CheckResult[];
  app: ReviewAppInfo | null;
}

export interface ReviewAppInfo {
  app_id: string;
  name: string;
}

export interface ReviewDetail {
  submission: Submission;
  reviews: Review[];
  checks: CheckResult[];
  app: ReviewAppInfo | null;
}

# FriendlyHub - Implementation Plan

**Domain:** friendlyhub.org

## Context

Flathub.org has a painful developer experience: hostile maintainers, opaque submission process, crumbling build infrastructure (stuck on 2021 Buildbot), and gatekeeping on non-safety concerns like icon aesthetics and GNOME naming conventions. FriendlyHub (friendlyhub.org) is a fully compatible alternative Flatpak repository that's actually friendly to developers, with a modern stack, clear review criteria, and automated build pipeline.

## Architecture Overview

```
                      CloudFront (CDN)
                            |
         +------------------+------------------+
         |                  |                  |
    /api/*             /repo/*            /* (SPA)
         |                  |                  |
  API Gateway + Lambda   S3 bucket        S3 bucket
  (FriendlyHub API)    (OSTree repo)    (React app)
         |                  ^
         |                  | (sync)
         |                  |
         |            ECS Fargate + EFS
         |            (flat-manager)
         |                  |
         +--------+---------+
                  |
           RDS PostgreSQL t4g.micro
          (flat-manager only)

  S3 (screenshots, icons)

  GitHub Actions (build pipeline)
    -> flatpak-builder
    -> flat-manager-client upload
    -> webhook callback to API
```

## Tech Stack

- **Backend:** Rust (Axum), DynamoDB (single-table design)
- **Frontend:** React + TypeScript, Vite, Tailwind CSS, TanStack Query
- **Database:** DynamoDB for FriendlyHub API; RDS PostgreSQL t4g.micro for flat-manager
- **Repo management:** flat-manager (existing Flatpak project tool, Rust-based)
- **Builds:** GitHub Actions with custom `flatpak-builder` container image
- **Auth:** GitHub OAuth2 + JWT sessions
- **Storage:** S3 (OSTree repo serving). Screenshots and icons served from GitHub repos (raw URLs).
- **Infrastructure (AWS):**
  - API: Lambda + API Gateway (via Lambda Web Adapter)
  - flat-manager: ECS Fargate + EFS (persistent storage, syncs to S3)
  - FriendlyHub DB: DynamoDB (single-table, pay-per-request)
  - flat-manager DB: RDS PostgreSQL t4g.micro (flat-manager requires PostgreSQL)
  - CDN: CloudFront
  - SPA hosting: S3 + CloudFront
  - OSTree repo serving: S3 + CloudFront (static files synced from flat-manager)
  - IaC: Serverless Framework V4 (single stack: Lambda/API GW native, Fargate/EFS/Aurora in resources block)
  - All AWS resources tagged `friendlyhub`

## Key Design Decisions

### Review Philosophy (the "friendly" part)
- Automated checks first (manifest lint, permissions audit, CVE scan, build success)
- Light human review focused ONLY on: malware/safety, accurate metadata, working app
- NO gatekeeping on: icon quality, naming conventions, desktop environment compliance, code quality
- No "rejected" status -- only "approved" or "changes requested" with friendly, actionable feedback
- Verified developers get fast-tracked on updates

### Submission & Build Pipeline (GitHub PR flow)
1. Developer forks a template repo in the `friendlyhub` GitHub org (one repo per app, named by app-id)
2. Developer adds their Flatpak manifest (JSON/YAML) + any shared-modules, opens a PR
3. CI runs automated checks on the PR (manifest lint, permissions audit, metadata validation)
4. A reviewer does a light human review on the PR (safety + accuracy only)
5. PR is approved and merged
6. Merge triggers a GitHub Actions build workflow (`workflow_dispatch`)
7. GHA runs `flatpak-builder`, produces the Flatpak, uploads to flat-manager
8. flat-manager atomically publishes the build into the public OSTree repository
9. flat-manager generates static deltas (efficient binary update diffs)
10. App is live -- users can `flatpak install` it immediately

**Updates follow the same flow:** developer opens a PR with manifest changes, CI + review, merge, build, publish.

### Compatibility
- Standard OSTree Flatpak remote -- works with `flatpak` CLI, GNOME Software, KDE Discover
- Users can run FriendlyHub alongside Flathub with no conflicts

## Database Design

### FriendlyHub API: DynamoDB (single-table design)
- Single table with PK/SK + GSI1 + GSI2
- Entity types: USER, APP, SUBMISSION, REVIEW, CHECK
- Pay-per-request billing (no idle cost)

### flat-manager: RDS PostgreSQL t4g.micro
- Dedicated PostgreSQL instance for flat-manager (it requires Postgres, no alternatives)
- Separate from the FriendlyHub API data
- ~$12/month (can upgrade to Aurora Serverless v2 for production if needed)

## API Design

All endpoints under `/api/v1/`:

- **Auth:** `GET /auth/github`, `GET /auth/github/callback`, `POST /auth/logout`, `GET /auth/me`
- **Apps (public):** `GET /apps` (search/browse), `GET /apps/{app_id}`, `GET /apps/{app_id}/releases`
- **Developer:** `POST /apps`, `PUT /apps/{app_id}`, `POST /apps/{app_id}/submit`, `GET /submissions`, `GET /submissions/{id}/logs`
- **Reviewer:** `GET /review/queue`, `POST /review/queue/{id}/claim`, `POST /review/queue/{id}/decision`
- **Admin:** `GET /admin/users`, `PUT /admin/users/{id}/role`, `POST /admin/featured`
- **Internal:** `GET /internal/flat-manager-url` (returns current flat-manager Fargate task IP), `POST /internal/refresh-appstream` (updates categories/keywords/icons from appstream.xml.gz), `POST /internal/process-install-counts` (processes CloudFront access logs to count installs)
- **Webhooks:** `POST /webhooks/github-actions`, `POST /webhooks/flat-manager`

## Project Structure

```
friendlyhub/
├── server/                     # Rust API (Axum + sqlx)
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── router.rs
│   │   ├── errors.rs
│   │   ├── auth/               # OAuth2, JWT, middleware
│   │   ├── models/             # user, app, submission, review, stats
│   │   ├── routes/             # auth, apps, submissions, review, internal, webhooks
│   │   ├── services/           # flat_manager, github, manifest, checks, search, storage
│   │   └── db/
│   ├── migrations/
│   └── tests/
├── web/                        # React + TypeScript SPA
│   ├── src/
│   │   ├── api/                # API client functions
│   │   ├── components/         # layout, apps, submissions, reviews, common
│   │   ├── pages/              # Home, Browse, AppDetail, developer/*, reviewer/*, admin/*
│   │   ├── hooks/
│   │   ├── stores/             # Zustand
│   │   └── types/
├── builder-image/              # Docker image for GHA (flatpak + flatpak-builder + flat-manager-client)
├── build-templates/            # GitHub Actions workflow templates
├── infra/                      # Serverless Framework V4 (serverless.yml + resources)
├── deploy/                     # flat-manager config, container definitions
├── docs/                       # developer-guide, reviewer-guide, admin-guide
└── docker-compose.yml          # Local dev environment (PostgreSQL + flat-manager)
```

## Implementation Phases

### Phase 1: Foundation (Backend skeleton + auth + flat-manager integration + AWS infra)
- [x] Monorepo setup, Rust project with Axum, sqlx, docker-compose for local dev
- [x] AWS infrastructure via Serverless Framework V4 (serverless.yml)
- [x] DynamoDB single-table design for FriendlyHub API
- [x] GitHub OAuth2 login + JWT sessions
- [x] flat-manager HTTP client service (create build, check status, publish)
- [x] ECS Fargate task definition for flat-manager + EFS mount
- [x] RDS PostgreSQL t4g.micro for flat-manager
- [x] flat-manager config.json + running on Fargate
- [x] Health check endpoints, basic CI

### Phase 2: Build Pipeline (End-to-end manifest -> published Flatpak)
- [x] Manifest validation service (JSON/YAML parsing, lint, app-id format)
- [x] GitHub API integration (create repo, push manifest, trigger workflow_dispatch)
- [x] Custom `flatpak-builder` Docker image for GHA
- [x] GitHub Actions workflow template
- [x] Webhook endpoint for build results
- [x] Submission status tracking
- [x] PR validation CI workflow (bridge GitHub PRs to FriendlyHub API)
- [x] Flat-manager URL discovery endpoint (Lambda looks up Fargate task IP)
- [x] Org-level GitHub secrets for build pipeline
- [x] End-to-end build: GHA workflow_dispatch -> flatpak-builder -> flat-manager upload (2026-03-05)
- [x] End-to-end test with real web submission (proper submission ID, status updates via webhook) (2026-03-06)

### Phase 3: Review System (Automated checks + human review)
- [x] Pluggable automated check framework
- [x] Core checks: manifest lint, permissions audit, metadata completeness
- [x] Review queue, claim, and decision endpoints
- [x] Publish automation on approval
- [x] Notification stubs
- [x] Test review flow end-to-end with real submission (claim, review, approve/request changes) (2026-03-06)
- [x] Verify webhook callback updates submission status correctly (building -> pending_review) (2026-03-06)

### Phase 4: Frontend MVP
- [x] Vite + React + TypeScript + Tailwind setup
- [x] Public: home, browse/search, app detail with `flatpak install` commands
- [x] Developer: submit app (manifest editor), submission status, build logs
- [x] Reviewer: queue, submission detail with check results, approve/request-changes
- [x] GitHub login flow

### Phase 5: Polish & Launch Prep
- [x] OSTree repo sync from EFS to S3 (sidecar container in Fargate task, `aws s3 sync` every 60s) (2026-03-06)
- [x] CloudFront distribution for OSTree repo serving (`dl.friendlyhub.org`, ACM wildcard cert, OAC) (2026-03-06)
- [x] `.flatpakrepo` file at `https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo` (2026-03-06)
- [x] GPG signing for OSTree repo (RSA 4096, key in SSM, flat-manager signs on publish) (2026-03-06)
- [x] Rate limiting (API Gateway throttling: 50 rps sustained, 100 burst) (2026-03-06)
- [x] UI improvements: metainfo XML parsing, app detail redesign (screenshots carousel, permissions card, license card, changelog, developer info, other apps by developer), review page shows app name/id, submit version requires metainfo (2026-03-06)
- [x] Appstream enrichment: categories, keywords, icon_url derived from appstream.xml.gz (s3-sync sidecar webhook -> refresh-appstream endpoint). Removed manual category picker from frontend/backend. (2026-03-06)
- [x] Frontend: AppCard shows icon_url, AppDetail shows keywords as badges (2026-03-06)
- [x] Download/install sizes: build.sh extracts via `du -sb`, webhook sends to API, stored on App, shown in AppDetail sidebar (2026-03-07)
- [x] Install counting: CloudFront standard logging -> CFLogsBucket -> process-install-counts parses logs, atomic DynamoDB increment, s3-sync sidecar triggers every iteration (2026-03-07)
- [x] Dev-to-prod migration: separate stage, new SSM params, new GitHub org secrets, new JWT token. All doable via scripts/setup.sh. (2026-03-07)
- [x] SPA CloudFront distribution (friendlyhub.org, www.friendlyhub.org) with API Gateway cache behavior (/api/*) (2026-03-07)
- [x] Dev environment torn down, prod stack deployed, all smoke tests passing (2026-03-07)
- [ ] Search tuning, admin dashboard
- [ ] Documentation, security audit, load testing

### Phase 6: Post-Launch (future)
- [ ] CLI tool (`friendlyhub submit`)
- [ ] Alternative OAuth providers (GitLab, Codeberg)
- [ ] Meilisearch for better search
- [ ] Auto-update detection from upstream
- [ ] Developer API keys for CI-driven submissions

## Deployment Notes (dev -> prod migration checklist)

### SSM Parameters Required
All under `/friendlyhub/{stage}/`:
- `github-token` — GitHub PAT classic with `repo`, `workflow`, `admin:org` scopes
- `github-client-id` — GitHub OAuth app client ID
- `github-client-secret` — GitHub OAuth app client secret
- `jwt-secret` — random string for JWT signing
- `flat-manager-secret` — fixed HMAC secret for flat-manager JWT signing (base64-encoded in config.json)
- `flat-manager-token` — shared secret for webhook auth (used by API verify_webhook_secret)
- `flat-manager-url` — (legacy, may be removed) flat-manager URL
- `flatmanager-db-password` — RDS PostgreSQL password for flat-manager
- `frontend-url` — frontend URL for CORS/redirects

### GitHub Org-Level Secrets (friendlyhub org)
Set at https://github.com/organizations/friendlyhub/settings/secrets/actions:
- `FRIENDLYHUB_API_URL` — API Gateway URL (e.g. `https://xxx.execute-api.eu-west-1.amazonaws.com`)
- `FLAT_MANAGER_TOKEN` — JWT token (HS256, signed with flat-manager-secret, scopes: build/upload/publish, 10yr expiry)
- `WEBHOOK_SECRET` — same value as SSM `flat-manager-token` (used for webhook auth)

### GitHub Org Settings
- Packages: must allow changing package visibility (needed to make GHCR images public)
- Packages to make public: `ghcr.io/friendlyhub/flatpak-builder`, `ghcr.io/friendlyhub/flat-manager`

### flat-manager (ECS Fargate)
- Custom wrapper image at `ghcr.io/friendlyhub/flat-manager:latest`
- Built from `deploy/flat-manager/Dockerfile` + `entrypoint.sh`
- Entrypoint generates `config.json` from env vars at startup
- Config written to EFS mount (`/var/data/flatmanager/config.json`), referenced via `REPO_CONFIG` env var
- OSTree repos use `archive-z2` mode (EFS doesn't support `bare-user` xattrs)
- flat-manager reads config path from `REPO_CONFIG` env var (not CWD)
- flat-manager must bind `0.0.0.0` (set via `"host": "0.0.0.0"` in config.json, default is 127.0.0.1)
- `FLAT_MANAGER_SECRET` env var must be set (from SSM) — otherwise random per restart and tokens won't match
- Collection ID: `org.friendlyhub.Stable`
- Needs public IP for GHA runners to reach it (discovered dynamically via API)

### flat-manager URL Discovery
- No ALB or static IP — Fargate task IP changes on restart
- Lambda endpoint `GET /api/v1/internal/flat-manager-url` looks up the current task IP
- Build script calls this endpoint before uploading to flat-manager
- Lambda needs IAM permissions: `ecs:ListTasks`, `ecs:DescribeTasks`, `ec2:DescribeNetworkInterfaces`
- For prod: consider ALB (~$16/mo) or Cloud Map for a stable endpoint

### Builder Image (`ghcr.io/friendlyhub/flatpak-builder:latest`)
- Built from `builder-image/Dockerfile`, auto-builds on push to `builder-image/**`
- Fedora 43 base with flatpak-builder, common runtimes pre-installed
- flat-manager-client is Python (NOT Rust) — installed via pip + curl from upstream
- Needs `python3-gobject` and `ostree-libs` for flat-manager-client (GI bindings for OSTree)
- `flat-manager-client --token TOKEN push BUILD_URL REPO` — `--token` is global flag before subcommand, BUILD_URL is full URL not repo name
- `--install-deps-from=flathub` flag on flatpak-builder auto-installs missing SDK extensions
- `--disable-rofiles-fuse` needed (FUSE may not work in containers)
- GHA workflow must use `options: --privileged` for bubblewrap (user namespaces)

### Build Workflow (`build-templates/build.yml`)
- Pushed to each app repo's `.github/workflows/build.yml`
- Container: `ghcr.io/friendlyhub/flatpak-builder:latest` with `--privileged`
- Auto-clones `flathub/shared-modules` if manifest references them
- Discovers flat-manager URL from `FRIENDLYHUB_API_URL/api/v1/internal/flat-manager-url`
- `FLAT_MANAGER_URL` secret is NOT needed (discovered dynamically)
- When updating build template, must also update existing app repos' workflows
- App repo workflows must NOT have `push` trigger (causes build storm on every commit to main)
- No `pr-check.yml` in app repos for now (creates spurious submissions on every push via submit-and-build job)

### Token Generation
- flat-manager uses HS256 JWT tokens
- Secret flow: raw secret -> base64 encode -> stored in config.json `"secret"` field -> flat-manager base64-decodes it -> uses raw bytes as HMAC key
- To generate token: sign JWT with raw secret bytes (NOT the base64-encoded version)
- Token claims: `sub`, `name`, `scope` (array of: build/upload/publish/generate/download), `repos`, `branches`, `exp`, `prefixes`, `apps`
- Generate with Python: `jwt.encode(claims, raw_secret.encode(), algorithm="HS256")`

### CloudFormation / Serverless Deploy
- Stack name: `friendlyhub-{stage}`
- ECS service stabilization can block deploys for 30+ min if tasks crash-loop
- Use `aws cloudformation cancel-update-stack` to abort stuck deploys
- After cancel, wait for `UPDATE_ROLLBACK_COMPLETE` before redeploying
- `aws ecs update-service --force-new-deployment` to force pulling new `latest` image
- Fargate caches image digests — force-new-deployment needed after pushing new `latest`

## Key Risks

| Risk | Mitigation |
|------|------------|
| GitHub Actions rate limits/costs | Design build trigger as pluggable trait; self-hosted runners as fallback; cache runtimes in builder image |
| flat-manager API changes | Pin version; wrap behind `FlatManagerClient` service trait; integration tests |
| Malicious manifests | Ephemeral build containers; `--disable-download` after source fetch; CVE scanning; human review |
| Reviewer bottleneck | Thorough automated checks keep human review fast; auto-approve updates from verified devs |
| Ecosystem adoption | Focus on DX; actively recruit Flathub-rejected apps; publish process comparison |

## Verification

1. **Unit tests:** `cargo test` for all services (manifest validation, check logic, API routes)
2. **Integration tests:** Docker Compose with real PostgreSQL + flat-manager; test full submission pipeline
3. **E2E test:** Submit a simple Flatpak manifest, verify it builds, passes review, and appears in the OSTree repo
4. **Frontend:** `npm test` + Playwright for critical user flows (login, submit app, review app)
5. **Manual:** `flatpak remote-add friendlyhub https://friendlyhub.org/repo/friendlyhub.flatpakrepo` and `flatpak install` a test app from the repo

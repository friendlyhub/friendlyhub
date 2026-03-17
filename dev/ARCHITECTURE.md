# FriendlyHub Architecture

## System Overview

```
                        CloudFront (friendlyhub.org)
                                  |
               +------------------+------------------+
               |                  |                  |
          /api/*             /repo/*            /* (SPA)
               |                  |                  |
        API Gateway           S3 bucket          S3 bucket
               |            (OSTree repo)      (React app)
           Lambda                 ^
        (Rust/Axum)               | s3 sync (60s)
               |                  |
               |            ECS Fargate + EFS
               |         +-------+--------+
               |         |                |
               |    flat-manager    purge-server
               |     (port 8080)    (port 8081)
               |         |
               |    RDS PostgreSQL
               |     (flat-manager only)
               |
          DynamoDB
       (single-table)

  GitHub Actions (build pipeline)
    -> flatpak-builder container (per-arch)
    -> flat-manager-client upload
    -> webhook callbacks to API
```

## Components

### Server (`server/`)

Rust API built on Axum, deployed as a Lambda function behind API Gateway via Lambda Web Adapter. The same binary runs locally for development (`cargo run`) or on Lambda (no code changes).

**Routes:**

| Module | Prefix | Key Endpoints |
|--------|--------|---------------|
| auth | `/auth` | `GET /github` (OAuth redirect), `GET /github/callback` (token exchange), `GET /me` |
| apps | `/apps` | `GET /` (browse/search), `POST /` (register), `GET /{id}` (detail), `GET /{id}/build-progress/{run_id}` (GHA job proxy), `POST /{id}/verify` (domain verification), `GET /{id}/flatpakref` |
| submissions | `/` | `POST /apps/{id}/submit` (new version), `GET /submissions` (mine), `GET /submissions/{id}` (detail + reviews + checks + source files) |
| review | `/review` | `GET /queue` (pending submissions), `GET /queue/{id}` (review detail), `POST /queue/{id}/decision` (approve/request changes) |
| admin | `/admin` | `GET /users`, `PUT /users/{id}/role`, `DELETE /users/{id}`, `GET /apps` |
| webhooks | `/webhooks` | `POST /build-started`, `POST /build-complete`, `POST /submit` (per-app repo merge), `POST /pr-submit` (submissions repo merge), `POST /validate-metainfo`, `POST /check-verification` |
| internal | `/internal` | `GET /flat-manager-url`, `POST /refresh-appstream`, `POST /process-install-counts`, `POST /update-summary` |

**Services:**

| Service | Purpose |
|---------|---------|
| `github.rs` | GitHub App auth (RS256 JWT -> installation token), repo CRUD, file push, workflow dispatch, run job status |
| `flat_manager.rs` | Discover Fargate task IP, publish builds, purge apps, update summary |
| `manifest.rs` | Validate Flatpak manifests (required fields, dangerous permissions, runtime checks) |
| `metainfo.rs` | Parse and validate AppStream metainfo XML (name, summary, screenshots, releases, branding) |
| `checks.rs` | Run automated checks on submissions (manifest_lint, permissions_audit, metadata_completeness) |
| `verification.rs` | App ID verification via domain well-known file or GitHub org ownership |
| `appstream.rs` | Sync app metadata (categories, keywords, icons) from appstream.xml.gz on S3 |
| `install_counts.rs` | Parse CloudFront access logs to count flatpak installs per app |
| `notifications.rs` | Post review decisions as GitHub issues on app repos |

**Auth:** GitHub OAuth2 -> JWT (HS256, 30-day expiry). Three roles: `developer`, `reviewer`, `admin`. Axum extractors: `AuthUser`, `ReviewerUser`, `AdminUser`.

**Error handling:** `AppError` enum (NotFound/Unauthorized/Forbidden/BadRequest/Internal) implements `IntoResponse`, returns JSON `{"error": "..."}`. Internal errors log details, return generic message.

### Frontend (`web/`)

React 19 SPA with TypeScript, Vite, Tailwind CSS 4, TanStack Query 5, Zustand 5.

**Pages:**
- Public: Home (carousel hero), Browse (search/paginate), App Detail (screenshots, permissions, changelog, install commands), Setup (distro-specific guides), Manifesto, Privacy
- Developer: My Apps, New App (original vs third-party flow), Submit Version (dual-pane manifest+metainfo editor with Monaco), Submission Detail (per-arch build progress), Verify App (domain/org verification)
- Reviewer: Review Queue, Review Detail (inline code quoting, approve/request changes)
- Admin: All Apps, Users (role management)

**State:** Zustand for auth (token in localStorage) and theme (light/dark/system). TanStack Query for all API data with 5s polling during builds.

**Build progress:** `BuildProgress` component polls `/api/v1/apps/{appId}/build-progress/{runId}` every 5s. The server proxies the GitHub Actions API to return live job steps. Each arch build gets its own `BuildProgress` card.

**Code splitting:** Admin, review, and submission pages lazy-loaded. Manual chunks for react, tanstack-query, and monaco-editor.

### Database

**DynamoDB** (single-table, pay-per-request):

| Entity | PK | SK | GSIs |
|--------|----|----|------|
| User | `USER#{uuid}` | `USER#{uuid}` | GSI1: `GHID#{github_id}` |
| App | `APP#{uuid}` | `APP#{uuid}` | GSI1: `APPID#{app_id_string}`, GSI2: `OWNER#{user_id}` |
| Submission | `SUB#{uuid}` | `SUB#{uuid}` | GSI1: `STATUS#{status}`, GSI2: `SUBMITTER#{user_id}` |
| Review | `SUB#{submission_id}` | `REV#{review_id}` | (queried via submission PK) |
| Check | `SUB#{submission_id}` | `CHK#{check_name}` | (queried via submission PK) |
| VerifiedDomain | `DOMAIN#{domain}` | `USER#{user_id}` | -- |

All reads use `consistent_read(true)` for immediate consistency after writes.

**RDS PostgreSQL** (t4g.micro): Used exclusively by flat-manager. Separate database, no shared access. flat-manager requires PostgreSQL internally.

### Build Pipeline

**Builder image** (`builder-image/`): Fedora 43 with flatpak-builder, pre-cached GNOME/KDE/freedesktop runtimes, and flat-manager-client (compiled from Rust source in a multi-stage build). Published to GHCR as `ghcr.io/friendlyhub/flatpak-builder:{arch}` (x86_64 and aarch64 variants).

**Build workflow** (`build-templates/build.yml`): Pushed to each app's GitHub repo. Triggered via `workflow_dispatch` with inputs: `submission_id`, `app_id`, `manifest_path`, `arch`. Runs on `ubuntu-latest` (x86_64) or `ubuntu-24.04-arm` (aarch64) with the builder container in `--privileged` mode.

**Build flow:**

```
Submission created (web UI or PR merge)
  |
  +-- For each target arch:
  |     |
  |     +-- workflow_dispatch to app repo's build.yml
  |           |
  |           +-- GHA spins up runner + pulls builder container
  |           |
  |           +-- build.sh starts:
  |           |     1. Discover flat-manager URL from API
  |           |     2. POST /webhooks/build-started (registers gha_run_id)
  |           |     3. flatpak-builder compiles the app
  |           |     4. Create flat-manager build
  |           |     5. flat-manager-client push (upload OSTree commits)
  |           |     6. Commit build, poll for completion
  |           |     7. POST /webhooks/build-complete
  |           |
  |           +-- On failure: POST /webhooks/build-complete with result=failure
  |
  +-- All arches succeed -> status: pending_review
  +-- Any arch fails -> status: build_failed
```

**PR-based submissions** (`build-templates/pr-check.yml`): Validates manifests on PR open. On merge to main, posts to `/webhooks/submit` which creates a submission and triggers builds. Commits tagged `[friendlyhub-api]` are skipped to prevent loops.

**Multi-arch:** Each arch builds independently with its own GHA run. The `builds` field on Submission is a `HashMap<String, ArchBuild>` tracking per-arch status, `gha_run_id`, `fm_build_id`, and `build_log_url`. Arch selection via `friendlyhub.json` (`only-arches`/`skip-arches`, compatible with Flathub's `flathub.json`) or the web UI dropdown.

### flat-manager (`deploy/flat-manager/`)

Custom wrapper around upstream `ghcr.io/flatpak/flat-manager`. Runs on ECS Fargate with EFS for persistent OSTree repo storage.

**Two containers in the Fargate task:**

1. **flat-manager** (port 8080): Receives builds, stores OSTree commits, publishes to repo. Config generated at startup from env vars by `entrypoint.sh`. Uses GPG signing (RSA 4096 key stored in SSM).

2. **purge-server** (port 8081, `purge-server.py`): Sidecar HTTP server for operations flat-manager doesn't support natively:
   - `POST /purge` -- delete all OSTree refs for an app
   - `POST /update-summary` -- regenerate repo summary, extract appstream, re-sign with GPG

**s3-sync sidecar:** Runs `aws s3 sync` every 60s from EFS to S3, invalidates CloudFront cache for summary/appstream paths, triggers `/internal/refresh-appstream` and `/internal/process-install-counts`.

**URL discovery:** No ALB. Lambda discovers the Fargate task's public IP via ECS/EC2 APIs. Build scripts call `/internal/flat-manager-url` before uploading.

### Infrastructure (`infra/`)

Serverless Framework V4, single stack per stage. Region: eu-west-1.

| Resource | Purpose |
|----------|---------|
| Lambda + API Gateway (HTTP API) | FriendlyHub API (256MB, 29s timeout, Web Adapter layer) |
| DynamoDB | API database (PAY_PER_REQUEST, PITR enabled) |
| ECS Fargate | flat-manager + purge-server (256 CPU / 512 MB) |
| EFS | Persistent OSTree repo storage for flat-manager |
| RDS PostgreSQL | flat-manager database (t4g.micro, 20GB gp3) |
| S3 (OstreeRepoBucket) | Public OSTree repo (synced from EFS) |
| S3 (SPABucket) | Frontend static files |
| S3 (CFLogsBucket) | CloudFront access logs (30-day lifecycle) |
| CloudFront (SPA) | friendlyhub.org -- SPA + API routing (/api/* -> API Gateway) |
| CloudFront (OSTree) | dl.friendlyhub.org -- repo files with OAC + CloudFront Function for content types |
| VPC | 10.0.0.0/16, 2 public subnets, security groups for Fargate/EFS/RDS |
| Route 53 | DNS for both CloudFront distributions |
| SSM Parameter Store | Secrets (GitHub keys, JWT secret, DB password, GPG key) |

### CI/CD (`.github/workflows/`)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `builder-image.yml` | Push to `builder-image/` | Matrix build (x86_64 + aarch64), push to GHCR, tag x86_64 as latest |
| `flat-manager-image.yml` | Push to `deploy/flat-manager/` | Build + push flat-manager wrapper image to GHCR |

Server deploys via `just deploy-prod` (cargo-lambda build + serverless deploy). Frontend deploys via `aws s3 sync` to the SPA bucket.

## Submission State Machine

```
pending_build -> building -> build_failed
                          -> pending_review -> approved -> published
                                            -> changes_requested
```

Reviews only allow `approved` or `changes_requested` (no "rejected" -- this is deliberate). On approval, the API publishes the flat-manager build and transitions to `published`.

## Verification

Apps can be verified via two methods:
- **Domain:** Place a token at `https://{domain}/.well-known/org.friendlyhub.VerifiedApps.txt`
- **GitHub org:** API checks org membership via the user's GitHub OAuth token (requires `read:org` scope)

Verified apps display a badge. Verified developers could be fast-tracked on updates (not yet implemented).

## Key Design Decisions

- **DynamoDB over PostgreSQL** for the API: pay-per-request, zero idle cost, no connection pooling headaches in Lambda.
- **No ALB for flat-manager:** saves ~$16/month. Dynamic IP discovery via ECS API adds ~200ms to build start, acceptable tradeoff.
- **GitHub App auth** (not PAT): installation tokens are short-lived, scoped to the org, and don't tie to a personal account.
- **Webhook-driven build status** (not polling): build script self-reports `gha_run_id` at start and result at end. The API never polls GitHub for build status.
- **flat-manager-client compiled from source:** upstream doesn't publish binaries. Multi-stage Docker build compiles the Rust client from the flat-manager repo.
- **OSTree repos in archive-z2 mode:** EFS doesn't support the xattrs required by bare-user mode.
- **Per-arch independent builds:** each architecture gets its own GHA workflow run, container image, and build log. No cross-compilation.

## Deployment

### SSM Parameters (under `/friendlyhub/{stage}/`)

`github-client-id`, `github-client-secret`, `github-app-id`, `github-app-installation-id`, `github-app-private-key`, `jwt-secret`, `flat-manager-secret` (base64-encoded HMAC key), `flat-manager-token` (webhook auth), `flatmanager-db-password`, `frontend-url`, `repo-gpg-key`, `repo-gpg-private-key`

### GitHub Org Secrets (friendlyhub org)

`FRIENDLYHUB_API_URL` (API Gateway URL), `FLAT_MANAGER_TOKEN` (HS256 JWT for flat-manager API), `WEBHOOK_SECRET` (shared secret for webhook auth)

### flat-manager Token Generation

flat-manager uses HS256 JWT. The secret in `config.json` is base64-encoded; flat-manager decodes it before use as the HMAC key. Generate tokens by signing with the raw (not base64) secret bytes. Claims: `sub`, `scope` (build/upload/publish/generate/download), `repos`, `exp`.

### Deploy Commands

```bash
just deploy-prod           # Lambda (cargo-lambda build + serverless deploy)
just deploy-web            # Frontend (npm build + s3 sync)

# flat-manager image update:
# push to deploy/flat-manager/ -> GHCR build -> then:
aws ecs update-service --cluster friendlyhub-prod --service flat-manager \
  --force-new-deployment --region eu-west-1

# Builder image update:
# push to builder-image/ -> auto-rebuilds on GitHub
```

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Components are versioned independently: **server**, **web**, **builder-image**, **infra**.

## [server-0.1.4] - 2026-07-25

### Fixed
- Multi-arch submissions could fail on the second architecture with `status 408` and an empty, non-JSON body from flat-manager's `missing_objects` endpoint. Each arch is dispatched as its own workflow run roughly two minutes apart, so the second builder routinely arrived while the first was still uploading. The build workflow — compiled into the server via `include_str!` and pushed to each app repo on submission — now declares a per-app `concurrency` group so the two arch runs queue instead of overlapping. `cancel-in-progress` is explicitly false, since cancelling would kill the arch already mid-upload. Costs wall-clock per submission, as the arch runs no longer overlap.

## [infra-0.1.2] - 2026-07-25

### Fixed
- flat-manager ran on actix's default worker count, which resolves to `available_parallelism()` — 2 on this task. Its `save_file()` is declared `async` but performs blocking `write_all`, `persist` and `set_permissions` directly on the worker thread, and against EFS each of those is a network round trip, so one upload parked a worker for the full 2-20 s it ran. A second builder whose connection was assigned to a parked worker had its request head go unread until actix's 5 s `client_request_timeout` returned a bare 408. That fires below the router, so the body was empty and the request never reached the access log — the failed build IDs had zero CloudWatch entries despite their `POST /api/v1/build` succeeding moments earlier. The generated config now sets `workers` to 16, overridable via `FM_WORKERS`; these threads are I/O-bound, so oversubscribing them is intended. This shortens the odds rather than eliminating them — actix assigns connections round-robin and a thread blocked in sync code still reports itself as available — so it backs up the workflow-level `concurrency` group rather than replacing it.

### Changed
- flat-manager Fargate task raised from 0.25 vCPU / 512 MB to 1 vCPU / 2 GB. At the old size the task sat at 96-102% CPU for the duration of any upload, sharing that quota with the `aws s3 sync` sidecar: `missing_objects` took 3.8-5.4 s per chunk and uploads 8-50 s each, against ~2.0 s and 2-19 s afterwards. Throughput only — this did not address the 408 above, which was blocked I/O rather than CPU starvation.

## [server-0.1.3] - 2026-07-10

### Fixed
- x86_64 Flatpak builds were failing during dependency installation with `Delta requires 1.7 GB free space, but only 592.2 MB available`. The app-repo build workflow ran inside a job-level GitHub Actions `container:`, whose Flatpak install filesystem was limited to a few hundred MB even though the runner host had ~90 GB free. The workflow — compiled into the server via `include_str!` and pushed to each app repo on submission — now runs the builder image with `docker run` on the host, preceded by a disk-cleanup step, so Flatpak installs into host-backed storage with ample space. aarch64 builds, on roomier ARM runners, were unaffected.

## [server-0.1.2] - 2026-04-20

### Fixed
- Multi-arch submission approval was failing to publish to the OSTree repo because the approval code only consulted the legacy single-arch `fm_build_id` field and logged a "cannot auto-publish" warning for any submission that stored its build IDs in the per-arch `builds` map. The approval path now iterates over `builds` when no top-level `fm_build_id` is set, publishing every arch's build before flipping the submission to `published`.

## [infra-0.1.1] - 2026-04-16

### Fixed
- CloudFront distribution-level `CustomErrorResponses` was hijacking API Gateway 404s and rewriting them to `/index.html`, causing the SPA to receive HTML instead of the API's JSON error body. SPA route fallback is now handled in the viewer-request CloudFront Function (default behavior only), so API responses pass through untouched.

## [web-0.1.1] - 2026-04-16

### Fixed
- API client now checks the response `content-type` and throws a readable error when the server returns a non-JSON body, instead of surfacing a cryptic `JSON.parse: unexpected character at line 1 column 1` to the user.

## [server-0.1.1] - 2026-03-24

### Fixed
- Domain verification failing on hosts that reject requests without a User-Agent header (e.g. Cloudflare)

## [builder-image-0.2.0] - 2026-03-24

### Changed
- Updated GNOME runtimes: dropped EOL 48, added 50 (kept 49)
- Updated KDE runtimes: dropped EOL 6.8, added 6.9 (kept 6.10)

## [server-0.1.0] - 2026-03-17

### Added
- Axum-based REST API running on Lambda via Web Adapter
- GitHub OAuth2 login with JWT sessions (developer/reviewer/admin roles)
- DynamoDB single-table design (User, App, Submission, Review, Check, VerifiedDomain)
- App registration with reverse-DNS validation
- App verification via domain well-known file or GitHub org ownership
- Submission workflow: manifest + metainfo validation, GitHub repo creation, workflow dispatch
- Multi-architecture build support (x86_64, aarch64) with per-arch status tracking
- Build-started and build-complete webhook endpoints for GHA build script
- Build progress proxy (forwards GitHub Actions job/step data to frontend)
- Automated checks: manifest lint, permissions audit, metadata completeness
- Review queue with approve/request-changes decisions
- Publish automation on approval (flat-manager integration)
- App delete with OSTree ref purge and GitHub repo cleanup
- flat-manager URL discovery via ECS task IP lookup
- AppStream enrichment from appstream.xml.gz on S3
- Install count processing from CloudFront access logs
- Notification service (GitHub issues on review decisions)
- Consistent DynamoDB reads for build status polling

## [web-0.1.0] - 2026-03-17

### Added
- React 19 SPA with TypeScript, Vite, Tailwind CSS 4
- Public pages: home (carousel hero), app browse/search, app detail (screenshots, permissions, changelog, install commands), distro-specific setup guides, Friendly Manifesto page, privacy policy
- Developer dashboard: my apps, new app registration (original vs third-party), domain verification, version submission with dual-pane Monaco editor (manifest + metainfo)
- Per-arch build progress cards with live GitHub Actions step tracking (5s polling)
- Reviewer interface: review queue, submission detail with inline code quoting, approve/request changes
- Admin pages: all apps listing, user role management
- Dark mode with system preference detection
- Zustand stores for auth (JWT in localStorage) and theme
- TanStack Query for API data fetching
- Code splitting: lazy-loaded admin/review/submission pages
- Responsive layout with collapsible sidebar

## [builder-image-0.1.0] - 2026-03-17

### Added
- Fedora 43 base with flatpak-builder
- Pre-cached runtimes: freedesktop (24.08, 25.08), GNOME (48, 49), KDE (6.8, 6.10)
- flat-manager-client compiled from Rust source (multi-stage Docker build)
- Build script (`friendlyhub-build`): flat-manager discovery, flatpak-builder invocation, upload, commit polling, webhook notifications
- Build-started webhook call at script start for live progress tracking
- Multi-arch images: `ghcr.io/friendlyhub/flatpak-builder:x86_64` and `:aarch64`
- CI workflow for automated image builds on push

## [infra-0.1.0] - 2026-03-17

### Added
- Serverless Framework V4 stack (eu-west-1)
- Lambda + HTTP API Gateway for FriendlyHub API
- DynamoDB table with GSI1/GSI2 (pay-per-request, PITR enabled)
- ECS Fargate service for flat-manager + purge-server sidecar
- EFS for persistent OSTree repo storage
- RDS PostgreSQL t4g.micro for flat-manager
- S3 buckets: OSTree repo, SPA hosting, CloudFront logs (30-day lifecycle)
- CloudFront distribution for SPA (friendlyhub.org) with API Gateway cache behavior
- CloudFront distribution for OSTree repo (dl.friendlyhub.org) with OAC and content-type function
- CloudFront Function for VitePress docs subpath resolution
- VPC with 2 public subnets, security groups for Fargate/EFS/RDS
- Route 53 DNS records
- SSM Parameter Store for secrets
- IAM roles for Lambda and Fargate

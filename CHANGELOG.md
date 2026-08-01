# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Components are versioned independently: **server**, **web**, **builder-image**, **infra**.

## [server-0.1.6] - 2026-08-01

### Changed
- Every GitHub Action pinned in this repo moved off the Node 20 runtime, which GitHub now warns is deprecated: `actions/checkout` v4 to v7, `actions/github-script` v7 to v9, `docker/login-action` v3 to v4, `docker/build-push-action` v6 to v7. The warning app maintainers were seeing came from `build-templates/build.yml`, which is compiled into the server via `include_str!` and pushed to each app repo on submission, so it was never theirs to fix. Existing apps pick up the new pins on their next submission; an app that never submits again keeps warning until it does. Of the breaking changes in those majors, `build-push-action` v7 drops `DOCKER_BUILD_NO_SUMMARY` and `DOCKER_BUILD_EXPORT_RETENTION_DAYS`, and `github-script` v9 drops `require('@actions/github')` in favour of an injected `getOctokit`; none of the three were used here.

### Fixed
- A submission pushed straight to an app repo's `main` triggered one build too many. The `submit-and-build` job in `build-templates/pr-check.yml` posted to `/webhooks/submit`, which resolves the app's architectures and dispatches `build.yml` once for each, and then dispatched `build.yml` a second time itself. The extra run carried no `arch`, so it defaulted to `x86_64` and raced the API's own `x86_64` run to report `build-complete` against the same submission and arch. Dispatching is the API's job — it is what resolves arches and calls `init_builds` — so the workflow step is gone. The same webhook path also omitted `app_id`, which `build.yml` declares as a required input and which its `concurrency` group keys on, so at best every app shared the single group `friendlyhub-build-` and serialised against each other rather than per-app; `/webhooks/submit` now sends it. `manifest_path` is deliberately still omitted on this path: these files belong to the developer, who may not have named the manifest `<app-id>.json`, so `build.yml` auto-detects it. None of this had fired in production — every `pr-check.yml` run in both live app repos was skipped by the `[friendlyhub-api]` guard, because uploads have so far gone through the web flow, which uses a different code path.
- The submissions repo's PR validation ran on `pull_request_target` and then checked out the fork's head commit, handing untrusted code a job holding `pull-requests: write` and `WEBHOOK_SECRET`. The manifest filename it detected is attacker-controlled — it comes from the PR's own tree, and only the containing directory was pattern-validated — yet it was interpolated directly into a `run:` block as `${{ steps.detect.outputs.manifest }}`. A submitted file named to include shell metacharacters therefore ran commands with the webhook secret in scope. `actions/checkout` v7 refuses fork checkouts under `pull_request_target` unless `allow-unsafe-pr-checkout` is set; rather than opt back in, the job no longer checks the head out at all. It resolves the changed directory from `pulls/{number}/files` and pulls just the manifest and metainfo through the contents API, which serves the head commit from this repo via `refs/pull/N/head` while the PR is open, writing them to fixed local paths. Directory entry names are filtered to `[A-Za-z0-9._-]` before being interpolated into a request URL. No filename originating from a PR now reaches a shell or the filesystem.

## [web-0.1.2] - 2026-07-25

### Fixed
- Automated check results showed only a count — "1 warning(s)", "1 potentially dangerous permission(s) detected" — with no way to see what had been flagged. The server had been storing and returning the specifics in each check's `details` field all along, and the frontend `CheckResult` type already declared it; `AutomatedChecks` simply never rendered it. The component now expands each check's findings inline, normalising the three shapes the server emits (`errors`/`warnings` from manifest lint, `flagged_permissions` from the permissions audit, `concerns` from metadata completeness). Findings are always expanded rather than behind a disclosure: passing checks emit no details at all, so the clean case is unchanged, and hiding them one click deep was the original complaint. Fixes both the reviewer's screen and the developer's own submission detail, which share the component.

### Added
- The manifest editor on the submission screen now reports non-blocking warnings, not just missing required fields: absent `runtime-version`, empty `finish-args`, and any `finish-arg` the shared permission catalog rates *sensitive*. These reuse the validation panel already present in `ManifestForm`, whose warning and info branches were written but previously unreachable, and are worded identically to what the reviewer will see post-submission.

### Changed
- `flatpak-permissions.catalog.json` and its schema moved from `web/src/data/` to `shared/`, since the Rust server now reads the same file. Vite's dev-server `fs.allow` is widened to the repo root to serve it; the production build needed no change.

## [server-0.1.5] - 2026-07-25

### Fixed
- A single dangerous `finish-arg` was reported twice, as both a manifest lint warning and a permissions audit finding, because `manifest::validate` and `checks::check_permissions_audit` each carried their own hardcoded list of the same four permissions with different wording. Permissions are now the audit check's job alone; `manifest::check_permissions` is gone.

### Changed
- The permissions audit is now backed by `shared/flatpak-permissions.catalog.json`, the same catalog the web frontend uses to render permission badges, replacing a four-pattern hardcoded list. New `services/permissions.rs` ports the frontend's `classifyPermission`: exact matches beat regex matches, ties break on priority then match-expression length then rule id, and the `[mode_suffix]`/`[path_suffix]`/`[device_suffix]`/`[class_suffix]` description templating is reproduced. A fixture table of args to expected rule and severity is asserted in both `services/permissions.rs` and `web/src/utils/permissions.test.ts`, so drift between the two readers fails a test.
- Coverage goes from 4 patterns to the catalog's 26 sensitive rules, so apps using `--socket=session-bus`, `--filesystem=home`, `--device=input`, `--allow=devel` and similar will now be flagged where they previously passed silently. Warnings do not block publishing, but expect a noisier review queue.
- Adds the `fancy-regex` dependency rather than `regex`: two catalog patterns (`filesystem-absolute-run`, `filesystem-absolute-generic`) use negative lookahead to exclude paths such as `/run/flatpak`, which the `regex` crate does not support. Rewriting those patterns would have reintroduced exactly the server/frontend divergence this change removes.

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

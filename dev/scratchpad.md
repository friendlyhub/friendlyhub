# PR-Based App Submission

Two paths for submitting apps via GitHub PRs. No web registration required.

## Path 1: New App — via `friendlyhub/submissions` repo

For first-time submissions. Developer forks the central submissions repo, adds their app, and opens a PR.

### Repo structure

```
friendlyhub/submissions/
  org.example.MyApp/
    org.example.MyApp.json            # Flatpak manifest (or .yaml/.yml)
    org.example.MyApp.metainfo.xml    # AppStream metainfo (must have <release>)
    cargo-sources.json                # Optional companion files (JSON only)
```

### Flow

1. Fork `friendlyhub/submissions`
2. Create a directory named with your app ID (reverse-DNS format, e.g. `org.example.MyApp`)
3. Add manifest + metainfo (and optional companion JSON files) to the directory
4. Open PR to `main`

**On PR open/update** (`pr-check.yml`):
- Validates exactly one app directory changed
- Validates directory name is reverse-DNS format
- Validates manifest via `POST /api/v1/manifests/validate`
- Validates metainfo via `POST /api/v1/webhooks/validate-metainfo`
- Checks that metainfo has at least one `<release>` with a version
- Checks domain verification via `POST /api/v1/webhooks/check-verification` (non-blocking)
- If domain is unverified, auto-comments on the PR with verification instructions

**On merge** (`on-merge.yml`):
- Detects changed directory, reads manifest + metainfo + companion files
- Determines PR author via `gh pr list --state merged --search "$SHA"`
- Calls `POST /api/v1/webhooks/pr-submit` with full payload

**Server-side** (`pr-submit` handler):
1. Validates manifest and metainfo
2. Extracts version from latest `<release>` tag in metainfo (rejects if none)
3. Verifies metainfo `<id>` matches the app_id directory name
4. Resolves GitHub username to user record (auto-creates via `GET /users/{username}` API if needed)
5. Creates app record (owner = PR author, `developer_type: "original"`)
6. Attempts domain verification (see Domain Verification section below)
7. Creates `friendlyhub/{app-id}` repo on GitHub
8. Pushes manifest, metainfo, companion files, and CI workflows to the repo
9. Adds PR author as **triage** collaborator on the app repo
10. Creates submission record, triggers build

### After submission

- Build runs via GHA on `friendlyhub/{app-id}`
- On success: automated checks run, submission enters review queue
- Reviewer approves or requests changes
- On approval: app published to the FriendlyHub repository
- Developer can log into friendlyhub.org with GitHub — their app appears under "My Apps" (linked by GitHub ID)

## Path 2: App Updates — via per-app repo

For subsequent versions. Developer has triage access on `friendlyhub/{app-id}` and submits PRs from a fork.

### Repo structure

```
friendlyhub/{app-id}/
  {app-id}.json (or .yaml/.yml)     # Flatpak manifest
  {app-id}.metainfo.xml              # AppStream metainfo
  cargo-sources.json                 # Optional companion files
  .github/workflows/
    build.yml                        # Managed by API
    pr-check.yml                     # Managed by API
```

Workflows are managed by the API. Developers should not edit them.

### Flow

1. Fork `friendlyhub/{app-id}`
2. Update manifest and/or metainfo (add new `<release>` tag)
3. Open PR to `main`

**On PR open/update** (`pr-check.yml`):
- Validates manifest via `POST /api/v1/manifests/validate`

**On merge** (`pr-check.yml`, push-to-main trigger):
- Skips if commit message contains `[friendlyhub-api]` (avoids double-trigger on web submissions)
- Extracts version from metainfo `<release>` tags (falls back to commit message regex, then `0.0.0-{sha7}`)
- Sends metainfo in webhook payload if present
- Calls `POST /api/v1/webhooks/submit`
- Triggers `build.yml`

**Server-side** (`webhook_submit` handler):
1. Validates manifest
2. Extracts version from metainfo if provided (falls back to payload version)
3. Creates submission record
4. Triggers GHA build

### Build pipeline

Same for both paths:
1. `flatpak-builder` inside `ghcr.io/friendlyhub/flatpak-builder:latest`
2. Creates flat-manager build, uploads repo, commits
3. Polls until success or failure
4. Webhooks back to `POST /api/v1/webhooks/build-complete`
5. On success: automated checks, submission -> `pending_review`
6. On failure: submission -> `build_failed`, developer checks GHA logs

## Domain Verification

Two verification strategies depending on the app ID format:

### Forge-based IDs (e.g. `io.github.username.AppName`)

- **At PR check time**: `check-verification` endpoint compares the GitHub username in the app ID against the PR author. Returns verified/unverified immediately.
- **At merge time**: `pr_submit` auto-verifies the app if the PR author's GitHub username matches the forge username component. No action needed from the developer.
- Org-based forge IDs (e.g. `io.github.myorg.AppName`): currently requires the PR author to match the org name. TODO: check org ownership via bot token.

### Custom domain IDs (e.g. `com.example.MyApp`)

- **At PR check time**: `check-verification` endpoint upserts the user, creates/gets a verification token for the domain, and checks the well-known URL. If unverified, returns the token so the workflow can comment on the PR with instructions.
- **PR comment**: Bot auto-comments with the domain, token, and well-known URL. Developer places the token at `https://example.com/.well-known/org.friendlyhub.VerifiedApps.txt`. On the next PR push or check re-run, the endpoint re-checks and the comment is replaced (or removed if now verified).
- **At merge time**: `pr_submit` checks the well-known URL again. If the token is found, the app is auto-verified. If not, the app is created as unverified — developer can verify later via the web dashboard.
- **Non-blocking**: Verification never blocks the PR or the merge. Unverified apps still build and enter review, but show as unverified on the website.

### Verification via web (fallback)

If domain verification wasn't completed during the PR flow, the developer can log into friendlyhub.org and verify from the web dashboard (same token-based flow).

## Version extraction

Version comes from the latest `<release>` tag in metainfo:

```xml
<releases>
  <release version="1.2.0" date="2026-03-12"/>
  <release version="1.1.0" date="2026-02-01"/>
</releases>
```

This extracts `1.2.0`. Metainfo must have at least one `<release>` for new submissions.

For per-app repo updates, fallback chain: metainfo release -> commit message regex (`v?\d+\.\d+[\.\d]*`) -> `0.0.0-{sha7}`.

## API endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/v1/webhooks/pr-submit` | webhook secret | New app from submissions repo merge |
| `POST /api/v1/webhooks/submit` | webhook secret | Update from per-app repo merge |
| `POST /api/v1/webhooks/check-verification` | webhook secret | Check domain verification, return token if unverified |
| `POST /api/v1/webhooks/validate-metainfo` | webhook secret | Validate metainfo XML (returns version, app_id) |
| `POST /api/v1/manifests/validate` | webhook secret | Validate Flatpak manifest |
| `POST /api/v1/webhooks/build-complete` | webhook secret | GHA build result callback |

## Collaborator access

Both web and PR submissions grant the app owner **triage** access on `friendlyhub/{app-id}`. This gives:
- Read access to code
- Create/manage issues and PRs (via fork, since repos are public)
- No direct push access

Added in `ensure_repo_and_build` (shared by both submission paths). Best-effort — failure to add collaborator doesn't block the submission.

## Secrets

Org-level GitHub Actions secrets (visibility: ALL repos):
- `FRIENDLYHUB_API_URL` — API base URL
- `WEBHOOK_SECRET` — shared secret for webhook auth
- `FLAT_MANAGER_TOKEN` — flat-manager auth token (used by build.yml)

## Key differences between paths

| Aspect | Submissions repo (new app) | Per-app repo (update) | Web UI |
|--------|----------------------------|----------------------|--------|
| Creates user/app records | Yes (auto) | No (must exist) | Yes (manual) |
| Creates GitHub repo | Yes | No (already exists) | Yes |
| Metainfo required | Yes | Optional (but recommended) | Yes |
| Version source | Metainfo only | Metainfo -> commit msg -> sha | Metainfo |
| Companion files | Sent in webhook payload | Already in repo | Uploaded via form |
| Collaborator added | Yes | Already added | Yes |
| Domain verification | Auto (forge) or token via PR comment (domain) | N/A (already verified or not) | Auto (forge) or token via web UI (domain) |
| Verification blocking | No | N/A | No (app created either way) |

## Testing with dummyapp

Use `dummyapp/` in this repo (gitignored). Files:
- `dummyapp/org.friendlyhub.DummyApp.yml` — Flatpak manifest
- `dummyapp/org.friendlyhub.DummyApp.metainfo.xml` — AppStream metainfo
- `dummyapp/org.friendlyhub.DummyApp.desktop` — Desktop entry
- `dummyapp/org.friendlyhub.DummyApp.svg` — Icon
- `dummyapp/src/main.rs` + `Cargo.toml` — GTK4 Rust app (button -> "Hello World!")

To test new app submission:
1. Fork `friendlyhub/submissions`
2. Add `org.friendlyhub.DummyApp/` with manifest + metainfo from `dummyapp/`
3. Open PR, verify pr-check validates and verification comment appears (if custom domain)
4. Merge, verify submission created + build triggered
5. Check: app record created, app repo created, build triggered, PR author is triage collaborator
6. Check: forge-based IDs are auto-verified, custom domains are unverified unless token was placed
7. Log into website as the PR author — app appears under "My Apps"

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

### Manifest requirements

- The manifest must reference the app's **upstream source repo** via `type: git` (not `type: dir`)
- Companion source files (e.g. `cargo-sources.json` for Rust apps) should be included in the submission directory alongside the manifest
- The manifest should reference companion files in its `sources` array (e.g. `"cargo-sources.json"`)
- The **metainfo file does NOT need to be in the upstream repo** — the API automatically injects it as a `{"type": "file", "path": "{app-id}.metainfo.xml"}` source into the manifest when pushing to the app repo, so flatpak-builder can find it during build
- The manifest's `build-commands` can include `install -Dm644 {app-id}.metainfo.xml ...` to install the metainfo into the Flatpak — it will be present in the build directory

### Flow

1. Fork `friendlyhub/submissions`
2. Create a directory named with your app ID (reverse-DNS format, e.g. `org.example.MyApp`)
3. Add manifest + metainfo (and optional companion JSON files) to the directory
4. Open PR to `main`

**On PR open/update** (`pr-check.yml`, trigger: `pull_request_target` + `issue_comment`):
- Uses `pull_request_target` to access org secrets from fork PRs (safe: workflow file comes from base branch)
- Validates exactly one app directory changed
- Validates directory name is reverse-DNS format
- Validates manifest via `POST /api/v1/manifests/validate`
- Validates metainfo via `POST /api/v1/webhooks/validate-metainfo`
- Checks that metainfo has at least one `<release>` with a version
- Checks domain verification via `POST /api/v1/webhooks/check-verification` (non-blocking)
- If domain is unverified, auto-comments on the PR with verification instructions
- If domain becomes verified on re-check, removes the verification comment and posts a success message
- Developer can comment `/recheck` on the PR to re-trigger validation without pushing a new commit

**On merge** (`on-merge.yml`):
- Detects changed directory (filters out hidden dirs like `.github`)
- Reads manifest + metainfo + companion files
- Determines PR author via GitHub `/commits/{sha}/pulls` API (with fallbacks to `gh pr list` search and commit author API)
- Calls `POST /api/v1/webhooks/pr-submit` with full payload

**Server-side** (`pr-submit` handler):
1. Validates manifest and metainfo
2. Extracts version from latest `<release>` tag in metainfo (rejects if none)
3. Verifies metainfo `<id>` matches the app_id directory name
4. Resolves GitHub username to user record (auto-creates via `GET /users/{username}` API if needed)
5. Creates app record (owner = PR author, `developer_type: "original"`)
6. Attempts domain verification (see Domain Verification section below)
7. Updates app metadata from metainfo (summary, description, etc.)
8. Creates `friendlyhub/{app-id}` repo on GitHub
9. Automatically injects metainfo as a file source into the manifest (if not already present)
10. Pushes manifest, metainfo, companion files, and CI workflows to the repo
11. Adds PR author as **triage** collaborator on the app repo
12. Creates submission record, triggers build (with retry on 404 for newly-pushed workflow files)

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
- Skips if commit message contains `[friendlyhub-api]` (avoids double-trigger on API-pushed commits)
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
- **PR comment**: Bot auto-comments with the domain, token, and well-known URL. Developer places the token at `https://example.com/.well-known/org.friendlyhub.VerifiedApps.txt`. Developer can comment `/recheck` to re-trigger validation. On successful verification, the comment is removed and replaced with "Domain verified successfully."
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
| Metainfo location | Submission dir (API injects into manifest as file source) | App repo (already present) | Uploaded via form |
| Version source | Metainfo only | Metainfo -> commit msg -> sha | Metainfo |
| Companion files | Sent in webhook payload | Already in repo | Uploaded via form |
| Collaborator added | Yes | Already added | Yes |
| Domain verification | Auto (forge) or token via PR comment (domain) | N/A (already verified or not) | Auto (forge) or token via web UI (domain) |
| Verification blocking | No | N/A | No (app created either way) |

## Implementation notes

### Workflow triggers

- **`pr-check.yml` in submissions repo** uses `pull_request_target` (not `pull_request`) because fork PRs on public repos don't receive secrets with the `pull_request` trigger. The `pull_request_target` trigger runs the workflow from the base branch with full secret access. This is safe because the workflow file itself comes from main — it only reads data files from the PR head.
- **`issue_comment` trigger** on the same workflow allows `/recheck` comments to re-trigger validation without new commits.
- **`on-merge.yml`** filters out hidden directories (e.g. `.github`) from changed directory detection to avoid false positives on workflow-only commits.

### PR author detection

The `on-merge.yml` workflow determines the PR author using a cascade:
1. GitHub `/commits/{sha}/pulls` API (most reliable)
2. `gh pr list --state merged --search "$SHA"` (backup)
3. GitHub `/commits/{sha}` API for `.author.login` (last resort)

The display name from `git log` is NOT used because it doesn't correspond to a GitHub login.

### Workflow dispatch retry

`trigger_build` in `github.rs` retries on 404 up to 3 times with increasing backoff (5s, 10s, 15s). This handles the race condition where GitHub hasn't indexed a newly-pushed workflow file yet.

### Metainfo injection

`ensure_repo_and_build` in `submissions.rs` automatically adds `{"type": "file", "path": "{app-id}.metainfo.xml"}` to each module's sources in the manifest before pushing to the app repo. This means the metainfo file (which lives alongside the manifest in the app repo) is available to flatpak-builder during the build, without requiring it to exist in the upstream source repo. The injection is skipped if the source is already present.

## Testing with dummyapp

Use `dummyapp/` in this repo (gitignored). Files:
- `dummyapp/org.friendlyhub.DummyApp.yml` — Flatpak manifest (sources point to `https://github.com/icemaltacode/dummyapp.git` tag `v0.1.0`)
- `dummyapp/org.friendlyhub.DummyApp.metainfo.xml` — AppStream metainfo
- `dummyapp/org.friendlyhub.DummyApp.desktop` — Desktop entry
- `dummyapp/org.friendlyhub.DummyApp.svg` — Icon
- `dummyapp/cargo-sources.json` — Vendored Rust crate sources (generated via `flatpak-cargo-generator Cargo.lock`)
- `dummyapp/src/main.rs` + `Cargo.toml` — GTK4 Rust app (button -> "Hello World!")

To test new app submission:
1. Fork `friendlyhub/submissions`
2. Add `org.friendlyhub.DummyApp/` with manifest + metainfo + cargo-sources.json from `dummyapp/`
3. Open PR, verify pr-check validates and verification comment appears (if custom domain)
4. Comment `/recheck` after placing well-known token to verify domain
5. Merge, verify submission created + build triggered
6. Check: app record created, app repo created, build triggered, PR author is triage collaborator (pending invite)
7. Check: forge-based IDs are auto-verified, custom domains are unverified unless token was placed
8. Check: submission appears in review queue after build succeeds
9. Log into website as the PR author — app appears under "My Apps"

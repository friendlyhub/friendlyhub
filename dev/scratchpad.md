# Multi-Architecture Build Support (x86_64 + aarch64)

## Current State

Today, FriendlyHub only builds for x86_64. This is baked in at every layer:

- **Builder image** (`builder-image/Dockerfile`): `FROM fedora:43` on x86_64, pre-caches x86_64-only runtimes
- **Build script** (`builder-image/build.sh`): runs `flatpak-builder` with no `--arch` flag (defaults to host arch)
- **Build workflow** (`build-templates/build.yml`): `runs-on: ubuntu-latest` (x86_64), single job, no matrix
- **Submission model** (`server/src/models/submission.rs`): one `gha_run_id`, one `fm_build_id`, one `build_log_url` per submission -- no concept of per-arch builds
- **Build trigger** (`server/src/routes/submissions.rs:ensure_repo_and_build`): dispatches one workflow run, records one run ID
- **Build-complete webhook** (`server/src/routes/webhooks.rs:build_complete`): expects one result per submission, transitions straight to `pending_review`
- **Appstream** (`server/src/services/appstream.rs`): hardcoded `repo/appstream/x86_64/appstream.xml.gz`
- **Icon URLs** (`server/src/routes/internal.rs`): hardcoded `repo/appstream/x86_64/icons/128x128/`
- **Purge server** (`deploy/flat-manager/purge-server.py:extract_appstream`): hardcoded `appstream/x86_64`
- **flat-manager config** (`deploy/flat-manager/entrypoint.sh`): single OSTree repo, no arch-specific config
- **Builder image CI** (`.github/workflows/builder-image.yml`): single-platform Docker build

The key insight: OSTree and flat-manager are already multi-arch capable. The refs are `app/{app_id}/{arch}/{branch}` -- both arches land in the same repo. The problem is purely in our build pipeline and submission tracking.

---

## Architecture Selection

### How developers choose target architectures

Neither the Flatpak manifest nor AppStream metainfo have a top-level field for specifying target CPU architectures. The ecosystem convention (established by Flathub) is a separate config file at the repo root.

FriendlyHub adopts the same convention with `friendlyhub.json`:

```json
{ "only-arches": ["x86_64"] }
```

or equivalently:

```json
{ "skip-arches": ["aarch64"] }
```

Rules:
- **No file** = build for all supported arches (x86_64 + aarch64)
- `only-arches` = build only for the listed arches
- `skip-arches` = build for all arches except the listed ones
- Both fields cannot be present simultaneously

This is intentionally compatible with Flathub's `flathub.json` format so developers migrating from Flathub don't have to learn a new convention.

Note: per-module `only-arches` / `skip-arches` in the Flatpak manifest itself still work as expected for conditional module compilation (e.g. fetching different binaries per arch).

### Web submission UI

The `SubmitVersion` page (`web/src/pages/SubmitVersion.tsx`) gains a **Target Platforms** dropdown in the submission area (between the source files section and the submit button):

```
Target Platforms:  [x86_64 + aarch64  v]
                   [x86_64 + aarch64   ]
                   [x86_64 only        ]
                   [aarch64 only       ]
```

Implementation:
- New state: `const [targetArches, setTargetArches] = useState<string>('both')`
- Values: `'both'` | `'x86_64'` | `'aarch64'`
- The dropdown renders as a `<select>` with Tailwind styling consistent with the rest of the form
- The selected value is passed in the submission API call as `target_arches: string[]`
- The server uses this to determine which arches to build for (instead of reading `friendlyhub.json` from the repo)

The `submitApp` function (`web/src/api/client.ts`) gains a `targetArches` parameter:

```typescript
export const submitApp = (
  appId: string,
  version: string,
  manifest: unknown,
  metainfo: string,
  sourceFiles?: Record<string, string>,
  targetArches?: string[],
) => ...
```

The server-side `SubmitRequest` (`server/src/routes/submissions.rs`) gains:

```rust
struct SubmitRequest {
    // ... existing fields ...
    #[serde(default)]
    target_arches: Vec<String>,
}
```

When `target_arches` is empty (backward compat), default to `["x86_64", "aarch64"]`.

The server writes a `friendlyhub.json` to the app repo alongside the manifest, so that PR-based rebuilds also respect the arch selection.

### PR submission flow

For PR submissions (`friendlyhub/submissions` repo), the developer includes a `friendlyhub.json` in their app directory:

```
org.example.MyApp/
  org.example.MyApp.yaml
  org.example.MyApp.metainfo.xml
  friendlyhub.json              # optional
```

The PR check workflow validates it. The `pr_submit` handler reads it from `source_files` and passes the arches through to `ensure_repo_and_build`.

If no `friendlyhub.json` is present, builds for all supported arches.

### Server-side arch resolution

`ensure_repo_and_build` determines the arch list:

```rust
fn resolve_arches(target_arches: &[String], source_files: &HashMap<String, String>) -> Vec<String> {
    // 1. If target_arches is non-empty (web submission), use that
    if !target_arches.is_empty() {
        return target_arches.clone();
    }

    // 2. Check for friendlyhub.json in source_files (PR submission)
    if let Some(config) = source_files.get("friendlyhub.json") {
        if let Ok(parsed) = serde_json::from_str::<FriendlyHubConfig>(config) {
            if let Some(only) = parsed.only_arches {
                return only;
            }
            if let Some(skip) = parsed.skip_arches {
                let all = vec!["x86_64".into(), "aarch64".into()];
                return all.into_iter().filter(|a| !skip.contains(a)).collect();
            }
        }
    }

    // 3. Default: all arches
    vec!["x86_64".into(), "aarch64".into()]
}
```

### App model: persisting arch selection

The App record in DynamoDB gains a `target_arches` field (string list). Set on first submission, updated on subsequent submissions if the developer changes their selection. This is used for display purposes (showing which platforms an app is available for on the app detail page) and for re-triggering builds.

---

## Design Decision: Two GHA Runs per Submission

Each submission triggers **one or two independent GitHub Actions workflow runs** depending on the arch selection. Not a matrix build, because:

1. GitHub's ARM runners are separate (`ubuntu-24.04-arm`) and may have different availability
2. Independent runs mean one arch failing doesn't block the other
3. Each run uses a different builder image tag (`:x86_64` vs `:aarch64`)
4. We need separate build logs and status tracking per arch

The submission moves to `pending_review` only when **all** builds for the selected arches succeed, or to `build_failed` if **any** fails.

---

## Data Model Changes

### New fields on Submission (DynamoDB)

Replace the single-build fields with per-arch fields:

```
# Remove (or keep as legacy, null for new submissions):
gha_run_id        -> REMOVED
gha_run_url       -> REMOVED
fm_build_id       -> REMOVED
build_log_url     -> REMOVED

# Add:
builds: {
  "x86_64": {
    "status": "building" | "success" | "failure",
    "gha_run_id": 12345,
    "gha_run_url": "https://...",
    "fm_build_id": 42,
    "build_log_url": "https://..."
  },
  "aarch64": {
    "status": "building" | "success" | "failure",
    "gha_run_id": 12346,
    "gha_run_url": "https://...",
    "fm_build_id": 43,
    "build_log_url": "https://..."
  }
}
```

Stored as a JSON string in DynamoDB (like `manifest` already is). The submission's top-level `status` still follows the existing state machine (`pending_build` -> `building` -> `pending_review` / `build_failed`), but now `building` means "at least one arch is still building" and the transition to `pending_review` only happens when all arches report success.

### Backward Compatibility

Old submissions (before this change) have the flat fields and `builds` is null. Frontend and API must handle both shapes. New submissions always use `builds`. No migration needed -- DynamoDB is schemaless.

### Submission Response Shape

The API response (`SubmissionResponse`) gains a `builds` field:

```json
{
  "id": "...",
  "status": "building",
  "builds": {
    "x86_64": { "status": "success", "gha_run_id": 123, "build_log_url": "..." },
    "aarch64": { "status": "building", "gha_run_id": 124, "build_log_url": null }
  },
  // Legacy fields still present for old submissions
  "gha_run_id": null,
  "build_log_url": null
}
```

---

## Implementation Plan

### Phase 1: Builder Image (aarch64 variant)

**Goal:** Produce two builder images: `ghcr.io/friendlyhub/flatpak-builder:x86_64` and `ghcr.io/friendlyhub/flatpak-builder:aarch64`.

#### 1.1 Dockerfile changes (`builder-image/Dockerfile`)

No changes to the Dockerfile itself. The runtimes are installed for the host architecture automatically by `flatpak install`. The same Dockerfile built on x86_64 caches x86_64 runtimes; built on aarch64, it caches aarch64 runtimes.

#### 1.2 Builder image CI (`.github/workflows/builder-image.yml`)

Change from a single build to a matrix build:

```yaml
jobs:
  build-and-push:
    runs-on: ${{ matrix.runner }}
    strategy:
      matrix:
        include:
          - arch: x86_64
            runner: ubuntu-latest
          - arch: aarch64
            runner: ubuntu-24.04-arm
    steps:
      # ... same checkout + login ...
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: builder-image
          push: true
          tags: |
            ghcr.io/friendlyhub/flatpak-builder:${{ matrix.arch }}
            ghcr.io/friendlyhub/flatpak-builder:${{ matrix.arch }}-${{ github.sha }}
```

Also keep `:latest` as an alias for `:x86_64` for backward compat during rollout.

**Why not QEMU/buildx cross-build?** Because flatpak runtime caching (`flatpak install`) must run natively. QEMU emulation would be extremely slow for installing hundreds of MB of runtimes.

#### 1.3 Build script changes (`builder-image/build.sh`)

Add `ARCH` env var support:

```bash
ARCH="${ARCH:-$(uname -m)}"
# Normalize: aarch64 stays as-is, x86_64 stays as-is
# flatpak-builder uses the same names

flatpak-builder \
    --force-clean \
    --arch="${ARCH}" \
    --repo="${REPO_DIR}" \
    ...
```

Also pass `ARCH` in the webhook payload so the server knows which arch completed:

```bash
WEBHOOK_BODY="{
    \"submission_id\": \"${SUBMISSION_ID}\",
    \"result\": \"success\",
    \"arch\": \"${ARCH}\",
    \"fm_build_id\": ${FM_BUILD_ID},
    ...
}"
```

Also add `gha_run_id` and `gha_run_url` to the webhook payload (the build script has access to `GITHUB_RUN_ID` and can construct the URL). This eliminates the need for `find_latest_run` on the server side.

---

### Phase 2: Build Workflow Template

**Goal:** The workflow dispatched per-app supports an `arch` input and selects the right runner + image.

#### 2.1 `build-templates/build.yml` changes

```yaml
on:
  workflow_dispatch:
    inputs:
      submission_id:
        description: "FriendlyHub submission UUID"
        required: true
        type: string
      app_id:
        description: "Flatpak app ID"
        required: true
        type: string
      manifest_path:
        description: "Path to the manifest file"
        required: false
        type: string
        default: ""
      arch:
        description: "Target architecture (x86_64 or aarch64)"
        required: true
        type: string
        default: "x86_64"

jobs:
  build:
    name: Build (${{ inputs.arch }})
    runs-on: ${{ inputs.arch == 'aarch64' && 'ubuntu-24.04-arm' || 'ubuntu-latest' }}
    container:
      image: ghcr.io/friendlyhub/flatpak-builder:${{ inputs.arch }}
      options: --privileged

    steps:
      # ... same as before ...
      - name: Build Flatpak
        env:
          ARCH: ${{ inputs.arch }}
          # ... rest same ...
        run: friendlyhub-build
```

The `notify failure` step also gains `ARCH`:

```yaml
      - name: Notify failure
        if: failure()
        env:
          ARCH: ${{ inputs.arch }}
          # ...
        run: |
          # ... same curl but add "arch": "${ARCH}" to the JSON body
```

#### 2.2 `build-templates/pr-check.yml` changes

The `submit-and-build` job currently triggers one `build.yml` dispatch. It now needs to trigger two, but this is actually handled server-side (see Phase 3). The `pr-check.yml` calls `/webhooks/submit` which triggers the builds. No change needed here -- the server handles dispatching both arches.

#### 2.3 `Justfile` / deployment scripts

The `just build` and `just deploy` commands don't need changes. The build templates are embedded at compile time via `include_str!`. Rebuilding the server binary picks up the new templates.

Verify: `just build && just deploy` still works unchanged. The new `build.yml` is backward-compatible (defaults `arch` to `x86_64`).

---

### Phase 3: Server Changes

#### 3.1 Submission model (`server/src/models/submission.rs`)

Add `ArchBuild` struct and `builds` field:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArchBuild {
    pub status: String,          // "pending" | "building" | "success" | "failure"
    pub gha_run_id: Option<i64>,
    pub gha_run_url: Option<String>,
    pub fm_build_id: Option<i32>,
    pub build_log_url: Option<String>,
}

pub struct Submission {
    // ... existing fields kept for backward compat ...
    pub gha_run_id: Option<i64>,      // legacy, null for new
    pub gha_run_url: Option<String>,   // legacy, null for new
    pub fm_build_id: Option<i32>,      // legacy, null for new
    pub build_log_url: Option<String>, // legacy, null for new

    // New: per-arch build tracking
    pub builds: Option<HashMap<String, ArchBuild>>,
}
```

`to_item()` serializes `builds` as a JSON string (same pattern as `manifest`).
`from_item()` deserializes it via `get_json_opt()`, defaulting to `None` for old submissions.

New helper functions:

```rust
/// Initialize builds for a new multi-arch submission
pub async fn init_builds(db: &Db, id: Uuid, arches: &[&str]) -> Result<(), AppError>

/// Update a single arch's build status and fields
pub async fn update_arch_build(db: &Db, id: Uuid, arch: &str, update: ArchBuild) -> Result<Submission, AppError>

/// Check if all arch builds are complete (all success or any failure)
pub fn all_builds_complete(builds: &HashMap<String, ArchBuild>) -> bool

/// Check if all arch builds succeeded
pub fn all_builds_succeeded(builds: &HashMap<String, ArchBuild>) -> bool
```

#### 3.2 Submission create with arches (`server/src/routes/submissions.rs`)

The `SubmitRequest` struct gains `target_arches`:

```rust
#[derive(Deserialize)]
struct SubmitRequest {
    version: String,
    manifest: Value,
    metainfo: String,
    #[serde(default)]
    source_files: HashMap<String, String>,
    #[serde(default)]
    target_arches: Vec<String>,
}
```

`ensure_repo_and_build` gains an `arches: &[String]` parameter. Currently dispatches one workflow; change to dispatch per-arch:

```rust
// Resolve arches and initialize per-arch build tracking
submission::init_builds(&state.db, submission_id, &arches).await?;

for arch in &arches {
    let inputs = serde_json::json!({
        "submission_id": submission_id.to_string(),
        "app_id": app_id,
        "manifest_path": format!("{app_id}.json"),
        "arch": arch,
    });
    state.github.trigger_build(repo, "build.yml", "main", &inputs).await?;
}

submission::update_status(&state.db, submission_id, "building").await?;
```

Also write `friendlyhub.json` to the app repo if the arch selection is not "both":

```rust
if arches.len() < 2 {
    let config = serde_json::json!({ "only-arches": arches });
    state.github.put_file(repo, "friendlyhub.json", &config.to_string(), "...").await?;
}
```

Remove the `find_latest_run` + `set_build_info` call. The build script now self-reports its run ID via the build-complete webhook.

#### 3.3 Build-complete webhook (`server/src/routes/webhooks.rs:build_complete`)

The payload gains `arch`, `gha_run_id`, and `gha_run_url` fields:

```rust
struct BuildCompletePayload {
    submission_id: Uuid,
    result: String,
    arch: Option<String>,       // None for legacy single-arch builds
    fm_build_id: Option<i32>,
    build_log_url: Option<String>,
    gha_run_id: Option<i64>,    // reported by build script
    gha_run_url: Option<String>,
    download_size: Option<i64>,
    installed_size: Option<i64>,
}
```

Logic change:

```
if arch is Some:
  -> construct ArchBuild from payload fields
  -> update builds[arch] via submission::update_arch_build
  -> if all_builds_succeeded(builds): transition to pending_review, run checks
  -> if any build failed: transition to build_failed
  -> otherwise: stay in building (other arch still running)
  -> notify per-arch (include arch in issue title for failures)
  -> only update app sizes for x86_64 builds
else:
  -> legacy path (unchanged, for in-flight old submissions)
```

**Race condition mitigation:** Two `build_complete` webhooks can arrive near-simultaneously. `update_arch_build` does a read-modify-write. Use a DynamoDB conditional update with `updated_at` as a version stamp -- if it changed between read and write, re-read and retry (optimistic concurrency). At our volume (single-digit concurrent builds), this is more than sufficient.

#### 3.4 Webhook submit (`server/src/routes/webhooks.rs:webhook_submit`)

Currently triggers one build. Change to resolve arches and trigger per-arch:

```rust
// Read friendlyhub.json from the app repo if it exists (best-effort)
let arches = resolve_arches_for_app_repo(&state, &payload.app_id).await;

submission::init_builds(&state.db, sub.id, &arches).await?;

for arch in &arches {
    let inputs = serde_json::json!({
        "submission_id": sub.id.to_string(),
        "arch": arch,
    });
    state.github.trigger_build(&payload.app_id, "build.yml", "main", &inputs).await?;
}
```

#### 3.5 PR submit (`server/src/routes/webhooks.rs:pr_submit`)

The `PrSubmitPayload` already includes `source_files`. The `friendlyhub.json` (if present in the submission directory) arrives as part of `source_files`. `ensure_repo_and_build` resolves arches from it.

#### 3.6 Notifications (`server/src/services/notifications.rs`)

Add optional `arch` parameter to `notify_build_complete`:

```rust
pub async fn notify_build_complete(
    github: &GitHubService,
    app_id: &str,
    version: &str,
    success: bool,
    build_log_url: Option<&str>,
    arch: Option<&str>,
)
```

When `arch` is Some, include it in the issue title: "Build failed (aarch64) - v1.2.3". When None (legacy or single-arch), keep the current title format.

#### 3.7 Sizes tracking

Only update `download_size` and `installed_size` on the App record when `arch == "x86_64"` (or when arch is None for legacy). x86_64 is the most common user platform, so its sizes are the most representative.

---

### Phase 4: Frontend Changes

#### 4.1 TypeScript types (`web/src/types/index.ts`)

Add `ArchBuild` interface and update `Submission`:

```typescript
export interface ArchBuild {
  status: string;
  gha_run_id?: number;
  gha_run_url?: string;
  fm_build_id?: number;
  build_log_url?: string;
}

export interface Submission {
  // ... existing fields ...
  // New:
  builds?: Record<string, ArchBuild>;
}
```

#### 4.2 API client (`web/src/api/client.ts`)

Update `submitApp` to accept `targetArches`:

```typescript
export const submitApp = (
  appId: string,
  version: string,
  manifest: unknown,
  metainfo: string,
  sourceFiles?: Record<string, string>,
  targetArches?: string[],
) =>
  request<...>(`/apps/${appId}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      version, manifest, metainfo,
      ...(sourceFiles && Object.keys(sourceFiles).length > 0
        ? { source_files: sourceFiles } : {}),
      ...(targetArches ? { target_arches: targetArches } : {}),
    }),
  });
```

#### 4.3 Submit Version page (`web/src/pages/SubmitVersion.tsx`)

Add target platforms dropdown in the submission area, between source files and the submit button:

```tsx
// State
const [targetArches, setTargetArches] = useState<string>('both');

// In the submission area, before the submit button:
<div className="...">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Target Platforms
  </label>
  <select
    value={targetArches}
    onChange={(e) => setTargetArches(e.target.value)}
    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
  >
    <option value="both">x86_64 + aarch64</option>
    <option value="x86_64">x86_64 only</option>
    <option value="aarch64">aarch64 only</option>
  </select>
  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
    Choose which CPU architectures to build for. Most apps should target both.
  </p>
</div>
```

The submit handler maps the dropdown value to the API:

```typescript
const archesForApi = targetArches === 'both'
  ? ['x86_64', 'aarch64']
  : [targetArches];

submitApp(appId!, version, normalizeManifest(manifest), metainfoText, sourceFiles, archesForApi);
```

#### 4.4 Submission Detail page (`web/src/pages/SubmissionDetail.tsx`)

Currently shows one build log link and one `BuildProgress` component. Change to show per-arch build progress side by side when `builds` exists:

```tsx
{sub.builds ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Object.entries(sub.builds).map(([arch, build]) => (
      <div key={arch} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{arch}</h3>
          <StatusBadge status={build.status} />
          {build.build_log_url && (
            <a href={build.build_log_url} className="..." target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" /> Build Log
            </a>
          )}
        </div>
        {build.gha_run_id && appInfo?.app_id && (
          <BuildProgress
            appId={appInfo.app_id}
            runId={build.gha_run_id}
            runUrl={build.gha_run_url}
            isBuilding={build.status === 'building' || build.status === 'pending'}
          />
        )}
        {build.fm_build_id && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            flat-manager build #{build.fm_build_id}
          </div>
        )}
      </div>
    ))}
  </div>
) : (
  // Legacy single-build display (unchanged)
  <>
    {sub.gha_run_id && appInfo?.app_id && (
      <BuildProgress
        appId={appInfo.app_id}
        runId={sub.gha_run_id}
        runUrl={sub.gha_run_url}
        isBuilding={sub.status === 'building' || sub.status === 'pending_build'}
      />
    )}
  </>
)}
```

The `BuildProgress` component (`web/src/components/BuildProgress.tsx`) takes `{ appId, runId, runUrl?, isBuilding }` and works per-run. No changes needed -- we just render one instance per arch.

#### 4.5 Info card (submission detail)

The existing info card shows a single `fm_build_id`. For multi-arch, move the per-arch flat-manager IDs into the per-arch build cards (above). The legacy path keeps the existing display.

---

### Phase 5: GitHub Issues for Build Logs (PR Workflow)

**Chosen: One issue per failed arch.** Each failed arch gets its own issue titled e.g. "Build failed (aarch64) - v1.2.3". Immediate feedback, no waiting for the other arch to finish.

When all arches succeed, a single "Build succeeded" issue is created (as today). The `notify_build_complete` call happens when `all_builds_succeeded` returns true.

---

### Phase 6: Appstream & purge-server Multi-Arch

#### 6.1 Appstream extraction (`deploy/flat-manager/purge-server.py:extract_appstream`)

Currently hardcoded to `appstream/x86_64`. OSTree generates per-arch appstream branches automatically. Change to loop over arches:

```python
ARCHES = ["x86_64", "aarch64"]

def extract_appstream():
    for arch in ARCHES:
        appstream_dir = os.path.join(REPO_PATH, "appstream", arch)
        for branch in (f"appstream/{arch}", f"appstream2/{arch}"):
            # ... same checkout logic ...
```

#### 6.2 Appstream fetching (`server/src/services/appstream.rs`)

Keep reading `repo/appstream/x86_64/appstream.xml.gz` only. The appstream data (app metadata, icons) is the same for both arches. **No change.**

#### 6.3 Icon URLs (`server/src/routes/internal.rs`)

Same situation. **No change.**

#### 6.4 Purge server ref deletion

Already handles multi-arch correctly: deletes all refs matching `app/{app_id}/` which covers both arches. **No change needed.**

---

### Phase 7: Rollout & Migration

#### 7.1 Rollout order

1. **Build and push aarch64 builder image.** Merge the builder-image CI changes and trigger the workflow. Wait for both `:x86_64` and `:aarch64` tags to be available in GHCR.

2. **Deploy the updated build script.** The new `build.sh` with `ARCH` support is backward-compatible (defaults to host arch). Push the new builder images.

3. **Deploy server changes.** The new `build_complete` handler supports both `arch: Some(...)` and `arch: None` (legacy). Old in-flight submissions continue to work via the legacy path.

4. **Deploy frontend changes.** The submission detail page handles both `builds` (new) and legacy fields.

5. **Update workflows in existing app repos.** The server pushes workflows on every submission, so existing apps get the new `build.yml` on their next submission automatically.

#### 7.2 In-flight submission handling

When we deploy, there may be submissions currently `building` with the old single-arch format. The `build_complete` handler's legacy path (no `arch` field) handles these. They complete normally and stay single-arch.

#### 7.3 Testing

1. Submit `com.keithvassallo.clustercut` (or `org.friendlyhub.DummyApp`) after deploying
2. Verify two GHA runs appear in the app repo (or one, if x86_64-only is selected)
3. Verify both builds complete and the submission transitions to `pending_review`
4. Verify the frontend shows both build logs side by side
5. Test failure: manually fail one arch and verify the submission goes to `build_failed`
6. Verify `flatpak remote-ls` shows refs for both arches
7. Test web UI: submit with "x86_64 only" and verify only one build runs
8. Test PR flow: include `friendlyhub.json` with `"only-arches": ["x86_64"]` and verify

---

## Open Questions

1. **GitHub ARM runner availability.** `ubuntu-24.04-arm` is available for public repos on GitHub Free/Team. FriendlyHub repos are public, so this should work. Verify by dispatching a test workflow with `runs-on: ubuntu-24.04-arm`.

2. **Runtime availability on aarch64.** All major runtimes (freedesktop, GNOME, KDE) are published for aarch64 on Flathub. Verify the specific versions we pre-cache (freedesktop 24.08/25.08, GNOME 48/49, KDE 6.8/6.10) are available.

3. **Cost.** ARM runners may have different pricing. Not a concern at current low volume.

4. **Build times.** aarch64 builds may differ in speed. Builds are independent so this doesn't block x86_64.

---

## Files to Change (Summary)

### Must change:
- `builder-image/build.sh` -- add ARCH env var, pass to flatpak-builder and webhook, self-report gha_run_id
- `build-templates/build.yml` -- add `arch` input, dynamic runner + image selection, pass ARCH to build script and failure webhook
- `.github/workflows/builder-image.yml` -- matrix build for both arches
- `server/src/models/submission.rs` -- add ArchBuild struct, builds field, helper functions
- `server/src/routes/submissions.rs` -- target_arches on SubmitRequest, resolve arches, dispatch per-arch, write friendlyhub.json
- `server/src/routes/webhooks.rs` -- handle per-arch build_complete, aggregate status, arch in all submit handlers
- `server/src/services/notifications.rs` -- add arch parameter to notify_build_complete
- `web/src/types/index.ts` -- add ArchBuild interface, builds field on Submission
- `web/src/api/client.ts` -- add targetArches to submitApp
- `web/src/pages/SubmitVersion.tsx` -- target platforms dropdown
- `web/src/pages/SubmissionDetail.tsx` -- side-by-side build logs per arch
- `docs/submitting-an-app.md` -- document target platforms dropdown
- `docs/submitting-via-pr.md` -- document friendlyhub.json

### Should change:
- `deploy/flat-manager/purge-server.py` -- extract_appstream for both arches

### No change needed:
- `builder-image/Dockerfile` -- same Dockerfile works for both arches
- `build-templates/pr-check.yml` -- build triggering goes through server
- `deploy/flat-manager/entrypoint.sh` -- OSTree repo is arch-agnostic
- `server/src/services/appstream.rs` -- keep reading x86_64 appstream only
- `server/src/routes/internal.rs` -- icon URLs stay x86_64
- `server/src/services/install_counts.rs` -- already parses arch from ref paths, counts per app_id not per arch
- `server/src/services/github.rs` -- find_latest_run removed from the flow (build script self-reports)
- `Justfile` -- no changes
- `infra/serverless.yml` -- Lambda stays x86_64 (it's the API server, not the builder)

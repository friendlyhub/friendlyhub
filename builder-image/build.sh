#!/bin/bash
# FriendlyHub build script — runs inside the builder container.
# Called by the GHA workflow with environment variables set.
#
# Required env vars:
#   MANIFEST_PATH    — path to the Flatpak manifest (JSON/YAML)
#   APP_ID           — the Flatpak app ID (e.g. org.example.App)
#   FLAT_MANAGER_TOKEN — flat-manager API token
#   REPO_NAME        — flat-manager repo name (e.g. "stable")
#   FRIENDLYHUB_API_URL — FriendlyHub API URL (used to discover flat-manager)
#   WEBHOOK_SECRET   — shared secret for webhook auth
#   SUBMISSION_ID    — FriendlyHub submission UUID
#
# Optional:
#   BRANCH           — Flatpak branch name (default: "stable")

set -euo pipefail

BRANCH="${BRANCH:-stable}"
ARCH="${ARCH:-$(uname -m)}"
BUILD_DIR="/build/builddir"
REPO_DIR="/build/repo"
STATE_DIR="/build/state"

echo "=== FriendlyHub Build ==="
echo "App: ${APP_ID}"
echo "Manifest: ${MANIFEST_PATH}"
echo "Branch: ${BRANCH}"
echo "Arch: ${ARCH}"

# Discover flat-manager URL from the FriendlyHub API
if [ -z "${FLAT_MANAGER_URL:-}" ]; then
    echo ">>> Discovering flat-manager URL..."
    FM_RESPONSE=$(curl -sf "${FRIENDLYHUB_API_URL}/api/v1/internal/flat-manager-url")
    FLAT_MANAGER_URL=$(echo "${FM_RESPONSE}" | jq -r '.url')
    if [ -z "${FLAT_MANAGER_URL}" ] || [ "${FLAT_MANAGER_URL}" = "null" ]; then
        echo "ERROR: Could not discover flat-manager URL"
        echo "Response: ${FM_RESPONSE}"
        exit 1
    fi
    echo ">>> flat-manager URL: ${FLAT_MANAGER_URL}"
fi
# Notify FriendlyHub that this arch build has started (sets gha_run_id for live progress)
GHA_RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}/actions/runs/${GITHUB_RUN_ID:-0}"
if [ -n "${SUBMISSION_ID}" ] && [ "${SUBMISSION_ID}" != "manual" ]; then
    curl -s -X POST "${FRIENDLYHUB_API_URL}/api/v1/webhooks/build-started" \
        -H "Content-Type: application/json" \
        -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
        -d "{\"submission_id\": \"${SUBMISSION_ID}\", \"arch\": \"${ARCH}\", \"gha_run_id\": ${GITHUB_RUN_ID:-0}, \"gha_run_url\": \"${GHA_RUN_URL}\"}" || true
fi
echo ""

# Step 1: Build the Flatpak
echo ">>> Building Flatpak..."
flatpak-builder \
    --force-clean \
    --arch="${ARCH}" \
    --repo="${REPO_DIR}" \
    --state-dir="${STATE_DIR}" \
    --default-branch="${BRANCH}" \
    --disable-cache \
    --install-deps-from=flathub \
    --disable-rofiles-fuse \
    "${BUILD_DIR}" \
    "${MANIFEST_PATH}"

echo ">>> Build complete."

# Extract sizes from the build output
INSTALLED_SIZE=$(du -sb "${BUILD_DIR}/files" 2>/dev/null | cut -f1)
DOWNLOAD_SIZE=$(du -sb "${REPO_DIR}" 2>/dev/null | cut -f1)
echo ">>> Installed size: ${INSTALLED_SIZE:-unknown} bytes"
echo ">>> Download size: ${DOWNLOAD_SIZE:-unknown} bytes"

# Step 2: Create a build in flat-manager
echo ">>> Creating flat-manager build..."
BUILD_RESPONSE=$(curl -s -X POST \
    "${FLAT_MANAGER_URL}/api/v1/build" \
    -H "Authorization: Bearer ${FLAT_MANAGER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"repo\": \"${REPO_NAME}\"}")

FM_BUILD_ID=$(echo "${BUILD_RESPONSE}" | jq -r '.id')
FM_BUILD_URL="${FLAT_MANAGER_URL}/api/v1/build/${FM_BUILD_ID}"

if [ "${FM_BUILD_ID}" = "null" ] || [ -z "${FM_BUILD_ID}" ]; then
    echo "ERROR: Failed to create flat-manager build"
    echo "Response: ${BUILD_RESPONSE}"

    # Notify FriendlyHub of failure
    GHA_RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}/actions/runs/${GITHUB_RUN_ID:-0}"
    curl -s -X POST "${FRIENDLYHUB_API_URL}/api/v1/webhooks/build-complete" \
        -H "Content-Type: application/json" \
        -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
        -d "{\"submission_id\": \"${SUBMISSION_ID}\", \"result\": \"failure\", \"arch\": \"${ARCH}\", \"gha_run_id\": ${GITHUB_RUN_ID:-0}, \"gha_run_url\": \"${GHA_RUN_URL}\"}"

    exit 1
fi

echo ">>> flat-manager build ID: ${FM_BUILD_ID}"

# Step 3: Upload the build to flat-manager
echo ">>> Uploading to flat-manager..."
flat-manager-client --token "${FLAT_MANAGER_TOKEN}" push \
    "${FM_BUILD_URL}" \
    "${REPO_DIR}"

# Step 4: Commit the build
echo ">>> Committing build..."
COMMIT_RESPONSE=$(curl -s -X POST \
    "${FLAT_MANAGER_URL}/api/v1/build/${FM_BUILD_ID}/commit" \
    -H "Authorization: Bearer ${FLAT_MANAGER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}')

echo ">>> Commit response: ${COMMIT_RESPONSE}"

# Wait for commit to finish processing
echo ">>> Waiting for commit to complete..."
for i in $(seq 1 30); do
    BUILD_STATE=$(curl -s \
        "${FLAT_MANAGER_URL}/api/v1/build/${FM_BUILD_ID}" \
        -H "Authorization: Bearer ${FLAT_MANAGER_TOKEN}" | jq -r '.repo_state')
    if [ "${BUILD_STATE}" = "1" ]; then
        echo ">>> Build committed successfully."
        break
    elif [ "${BUILD_STATE}" = "3" ]; then
        echo "ERROR: Commit failed (repo_state=3)"
        exit 1
    fi
    sleep 2
done

if [ "${BUILD_STATE}" != "1" ]; then
    echo "ERROR: Commit did not complete in time (repo_state=${BUILD_STATE})"
    exit 1
fi

# Step 5: Notify FriendlyHub API
echo ">>> Notifying FriendlyHub..."
GHA_RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}/actions/runs/${GITHUB_RUN_ID:-0}"

WEBHOOK_BODY="{
        \"submission_id\": \"${SUBMISSION_ID}\",
        \"result\": \"success\",
        \"arch\": \"${ARCH}\",
        \"gha_run_id\": ${GITHUB_RUN_ID:-0},
        \"gha_run_url\": \"${GHA_RUN_URL}\",
        \"fm_build_id\": ${FM_BUILD_ID},
        \"build_log_url\": \"${GHA_RUN_URL}\""
if [ -n "${DOWNLOAD_SIZE}" ]; then
    WEBHOOK_BODY="${WEBHOOK_BODY}, \"download_size\": ${DOWNLOAD_SIZE}"
fi
if [ -n "${INSTALLED_SIZE}" ]; then
    WEBHOOK_BODY="${WEBHOOK_BODY}, \"installed_size\": ${INSTALLED_SIZE}"
fi
WEBHOOK_BODY="${WEBHOOK_BODY} }"

curl -s -X POST "${FRIENDLYHUB_API_URL}/api/v1/webhooks/build-complete" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
    -d "${WEBHOOK_BODY}"

echo ""
echo "=== Build pipeline complete ==="
echo "App ${APP_ID} uploaded to flat-manager (build ${FM_BUILD_ID})"
echo "Submission ${SUBMISSION_ID} moved to pending_review"

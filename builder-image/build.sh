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
BUILD_DIR="/build/builddir"
REPO_DIR="/build/repo"
STATE_DIR="/build/state"

echo "=== FriendlyHub Build ==="
echo "App: ${APP_ID}"
echo "Manifest: ${MANIFEST_PATH}"
echo "Branch: ${BRANCH}"

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
echo ""

# Step 1: Build the Flatpak
echo ">>> Building Flatpak..."
flatpak-builder \
    --force-clean \
    --repo="${REPO_DIR}" \
    --state-dir="${STATE_DIR}" \
    --default-branch="${BRANCH}" \
    --disable-cache \
    --install-deps-from=flathub \
    --disable-rofiles-fuse \
    "${BUILD_DIR}" \
    "${MANIFEST_PATH}"

echo ">>> Build complete."

# Step 2: Create a build in flat-manager
echo ">>> Creating flat-manager build..."
BUILD_RESPONSE=$(curl -s -X POST \
    "${FLAT_MANAGER_URL}/api/v1/build" \
    -H "Authorization: Bearer ${FLAT_MANAGER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"repo\": \"${REPO_NAME}\"}")

FM_BUILD_ID=$(echo "${BUILD_RESPONSE}" | jq -r '.id')
FM_BUILD_REPO=$(echo "${BUILD_RESPONSE}" | jq -r '.repo')

if [ "${FM_BUILD_ID}" = "null" ] || [ -z "${FM_BUILD_ID}" ]; then
    echo "ERROR: Failed to create flat-manager build"
    echo "Response: ${BUILD_RESPONSE}"

    # Notify FriendlyHub of failure
    curl -s -X POST "${FRIENDLYHUB_API_URL}/api/v1/webhooks/build-complete" \
        -H "Content-Type: application/json" \
        -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
        -d "{\"submission_id\": \"${SUBMISSION_ID}\", \"result\": \"failure\"}"

    exit 1
fi

echo ">>> flat-manager build ID: ${FM_BUILD_ID}"

# Step 3: Upload the build to flat-manager
echo ">>> Uploading to flat-manager..."
flat-manager-client --token "${FLAT_MANAGER_TOKEN}" push \
    "${FM_BUILD_REPO}" \
    "${REPO_DIR}"

# Step 4: Commit the build
echo ">>> Committing build..."
curl -s -X POST \
    "${FLAT_MANAGER_URL}/api/v1/build/${FM_BUILD_ID}/commit" \
    -H "Authorization: Bearer ${FLAT_MANAGER_TOKEN}"

echo ">>> Build committed successfully."

# Step 5: Notify FriendlyHub API
echo ">>> Notifying FriendlyHub..."
GHA_RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}/actions/runs/${GITHUB_RUN_ID:-0}"

curl -s -X POST "${FRIENDLYHUB_API_URL}/api/v1/webhooks/build-complete" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
    -d "{
        \"submission_id\": \"${SUBMISSION_ID}\",
        \"result\": \"success\",
        \"fm_build_id\": ${FM_BUILD_ID},
        \"build_log_url\": \"${GHA_RUN_URL}\"
    }"

echo ""
echo "=== Build pipeline complete ==="
echo "App ${APP_ID} uploaded to flat-manager (build ${FM_BUILD_ID})"
echo "Submission ${SUBMISSION_ID} moved to pending_review"

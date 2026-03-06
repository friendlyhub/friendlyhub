#!/bin/bash
set -euo pipefail

# Generate flat-manager config.json from environment variables
# This runs at container startup in Fargate

DATA_DIR="${DATA_DIR:-/var/data/flatmanager}"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"
FM_SECRET="${FLAT_MANAGER_SECRET:-$(openssl rand -base64 32)}"
FM_PORT="${FM_PORT:-8080}"
CONFIG_PATH="${REPO_CONFIG:-${DATA_DIR}/config.json}"
GPG_HOMEDIR="${DATA_DIR}/gpg"
GPG_KEY_ID=""

# Ensure repo directories exist
mkdir -p "${DATA_DIR}/repo"
mkdir -p "${DATA_DIR}/build-repo"

# Initialize the OSTree repos if they don't exist
if [ ! -d "${DATA_DIR}/repo/objects" ]; then
    echo "Initializing OSTree repo at ${DATA_DIR}/repo..."
    ostree init --mode=archive-z2 --repo="${DATA_DIR}/repo"
fi

if [ ! -d "${DATA_DIR}/build-repo/objects" ]; then
    echo "Initializing OSTree build-repo at ${DATA_DIR}/build-repo..."
    ostree init --mode=archive-z2 --repo="${DATA_DIR}/build-repo"
fi

# Set up GPG key for OSTree signing
if [ -n "${GPG_PRIVATE_KEY:-}" ]; then
    echo "Importing GPG signing key..."
    mkdir -p "${GPG_HOMEDIR}"
    chmod 700 "${GPG_HOMEDIR}"
    echo "${GPG_PRIVATE_KEY}" | gpg --homedir "${GPG_HOMEDIR}" --batch --import 2>&1
    GPG_KEY_ID=$(gpg --homedir "${GPG_HOMEDIR}" --list-keys --keyid-format long --with-colons 2>/dev/null | grep '^pub' | head -1 | cut -d: -f5)
    echo "GPG key imported: ${GPG_KEY_ID}"
else
    echo "WARNING: No GPG_PRIVATE_KEY set, OSTree repo will not be signed"
fi

# Encode secret safely (single line, no trailing newline)
ENCODED_SECRET=$(echo -n "${FM_SECRET}" | base64 | tr -d '\n')

# Escape values for safe JSON embedding (handle \, ", and control chars)
json_escape() {
    printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1], end="")'  2>/dev/null \
    || printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

SAFE_DB_URL=$(json_escape "${DB_URL}")
SAFE_SECRET=$(json_escape "${ENCODED_SECRET}")

cat > "${CONFIG_PATH}" <<EOF
{
    "repos": {
        "stable": {
            "path": "${DATA_DIR}/repo",
            "collection-id": "org.friendlyhub.Stable",
            "suggested-repo-name": "friendlyhub",
            "runtime-repo-url": "https://dl.flathub.org/repo/flathub.flatpakrepo",
            "gpg-key": null,
            "base-url": null,
            "subsets": {
                "all": {
                    "collection-id": "org.friendlyhub.Stable",
                    "base-url": null
                }
            }
        }
    },
    "host": "0.0.0.0",
    "port": ${FM_PORT},
    "delay-update-secs": 10,
    "database-url": "${SAFE_DB_URL}",
    "build-repo-base": "${DATA_DIR}/build-repo",
    "build-gpg-key": $([ -n "${GPG_KEY_ID}" ] && echo "\"${GPG_KEY_ID}\"" || echo "null"),
    "gpg-homedir": $([ -n "${GPG_KEY_ID}" ] && echo "\"${GPG_HOMEDIR}\"" || echo "null"),
    "secret": "${SAFE_SECRET}"
}
EOF

# Verify config file exists and is valid JSON
echo "--- Config verification ---"
echo "Config path: ${CONFIG_PATH}"
ls -la "${CONFIG_PATH}"

if python3 -c "import json; json.load(open('${CONFIG_PATH}'))" 2>/dev/null; then
    echo "Config JSON: VALID"
elif python3 -m json.tool "${CONFIG_PATH}" > /dev/null 2>&1; then
    echo "Config JSON: VALID"
else
    echo "WARNING: Config JSON validation not available or INVALID"
    echo "Config contents:"
    cat "${CONFIG_PATH}"
fi

echo "Data directory: ${DATA_DIR}"
echo "Listening on port: ${FM_PORT}"

# Start the purge server (handles OSTree ref deletion on app delete)
echo "--- Starting purge server on port 8081 ---"
python3 /purge-server.py &

echo "--- Starting flat-manager ---"
exec /usr/local/bin/flat-manager

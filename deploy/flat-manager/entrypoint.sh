#!/bin/bash
set -euo pipefail

# Generate flat-manager config.json from environment variables
# This runs at container startup in Fargate

DATA_DIR="${DATA_DIR:-/var/data/flatmanager}"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"
FM_SECRET="${FLAT_MANAGER_SECRET:-$(openssl rand -base64 32)}"
FM_PORT="${FM_PORT:-8080}"

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

cat > /config.json <<EOF
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
    "port": ${FM_PORT},
    "delay-update-secs": 10,
    "database-url": "${DB_URL}",
    "build-repo-base": "${DATA_DIR}/build-repo",
    "build-gpg-key": null,
    "gpg-homedir": null,
    "secret": "$(echo -n "${FM_SECRET}" | base64)"
}
EOF

echo "flat-manager config written to /config.json"
echo "Data directory: ${DATA_DIR}"
echo "Listening on port: ${FM_PORT}"

exec /usr/local/bin/flat-manager

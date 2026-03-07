#!/usr/bin/env bash
set -euo pipefail

# FriendlyHub AWS Setup
# Generates secrets and stores them as SSM parameters for use by serverless.yml.
# Usage: ./scripts/setup.sh [stage]
#   stage defaults to "dev"

STAGE="${1:-dev}"
REGION="${AWS_REGION:-eu-west-1}"
PREFIX="/friendlyhub/${STAGE}"

echo "================================================"
echo "  FriendlyHub Setup - stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "================================================"
echo ""

# Check prerequisites
for cmd in aws openssl python3; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: '${cmd}' is required but not found. Install it first."
        exit 1
    fi
done

# Check python3 has PyJWT
if ! python3 -c "import jwt" 2>/dev/null; then
    echo "ERROR: Python 'PyJWT' package is required. Install with: pip install PyJWT"
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: ${ACCOUNT_ID}"
echo ""

put_param() {
    local name="$1"
    local value="$2"
    local type="${3:-SecureString}"
    local tier="${4:-Standard}"

    local extra_args=()
    if [ "$tier" = "Advanced" ]; then
        extra_args+=(--tier Advanced)
    fi

    aws ssm put-parameter \
        --region "$REGION" \
        --name "${PREFIX}/${name}" \
        --value "$value" \
        --type "$type" \
        --overwrite \
        --output text \
        --query "Version" \
        "${extra_args[@]}" > /dev/null

    echo "  Stored ${PREFIX}/${name}"
}

STEP=1
TOTAL=9

# ---- JWT Secret ----
echo "[${STEP}/${TOTAL}] JWT Secret"
echo "  Generating a random 64-character secret..."
JWT_SECRET=$(openssl rand -base64 48)
put_param "jwt-secret" "$JWT_SECRET"
echo ""
STEP=$((STEP + 1))

# ---- GitHub OAuth App ----
echo "[${STEP}/${TOTAL}] GitHub OAuth App"
echo ""
if [ "$STAGE" = "prod" ]; then
    echo "  PRODUCTION: You need a GitHub OAuth App for prod."
    echo "  Create one at: https://github.com/settings/developers -> 'New OAuth App'"
    echo ""
    echo "  Settings:"
    echo "    Application name: FriendlyHub"
    echo "    Homepage URL:     https://friendlyhub.org"
    echo "    Callback URL:     https://friendlyhub.org/api/v1/auth/github/callback"
else
    echo "  You need a GitHub OAuth App. Create one at:"
    echo "    https://github.com/settings/developers -> 'New OAuth App'"
    echo ""
    echo "  Settings:"
    echo "    Application name: FriendlyHub (${STAGE})"
    echo "    Homepage URL:     https://friendlyhub.org"
    echo "    Callback URL:     (you'll update this after deploy with the API Gateway URL)"
fi
echo ""

read -rp "  GitHub Client ID: " GITHUB_CLIENT_ID
if [ -z "$GITHUB_CLIENT_ID" ]; then
    echo "  Skipping GitHub OAuth (you can re-run this script later)."
else
    read -rp "  GitHub Client Secret: " GITHUB_CLIENT_SECRET
    put_param "github-client-id" "$GITHUB_CLIENT_ID"
    put_param "github-client-secret" "$GITHUB_CLIENT_SECRET"
fi
echo ""
STEP=$((STEP + 1))

# ---- flat-manager secret + JWT ----
echo "[${STEP}/${TOTAL}] flat-manager Secret & JWT"
echo ""

read -rp "  flat-manager HMAC secret [auto-generate]: " FM_SECRET
if [ -z "$FM_SECRET" ]; then
    FM_SECRET=$(openssl rand -hex 32)
    echo "  Generated HMAC secret."
fi
put_param "flat-manager-secret" "$FM_SECRET"

# Generate JWT token automatically
echo "  Generating flat-manager JWT (10-year expiry, build scopes)..."
FM_JWT=$(python3 -c "
import jwt, time
claims = {
    'sub': 'build',
    'name': 'FriendlyHub Builder',
    'scope': ['build', 'upload', 'publish', 'generate', 'download'],
    'repos': ['stable'],
    'branches': ['stable'],
    'prefixes': [''],
    'apps': [''],
    'exp': int(time.time()) + (10 * 365 * 24 * 3600),
}
token = jwt.encode(claims, '${FM_SECRET}'.encode(), algorithm='HS256')
print(token)
")
put_param "flat-manager-jwt" "$FM_JWT"
echo ""
STEP=$((STEP + 1))

# ---- flat-manager webhook secret ----
echo "[${STEP}/${TOTAL}] flat-manager Webhook Secret"
echo ""
FM_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "  Generated webhook secret."
put_param "flat-manager-token" "$FM_WEBHOOK_SECRET"
echo ""
STEP=$((STEP + 1))

# ---- flat-manager DB password ----
echo "[${STEP}/${TOTAL}] flat-manager Database Password"
echo ""
read -rp "  RDS password [auto-generate]: " FM_DB_PASS
if [ -z "$FM_DB_PASS" ]; then
    # RDS-safe password: no special chars that could break connection strings
    FM_DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    echo "  Generated RDS password."
fi
put_param "flatmanager-db-password" "$FM_DB_PASS"
echo ""
STEP=$((STEP + 1))

# ---- Frontend URL ----
echo "[${STEP}/${TOTAL}] Frontend URL"
echo ""
if [ "$STAGE" = "prod" ]; then
    FRONTEND_URL="https://friendlyhub.org"
    echo "  Using: ${FRONTEND_URL}"
else
    read -rp "  Frontend URL [http://localhost:5173]: " FRONTEND_URL
    FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
fi
put_param "frontend-url" "$FRONTEND_URL" "String"
echo ""
STEP=$((STEP + 1))

# ---- GitHub Token (for triggering builds) ----
echo "[${STEP}/${TOTAL}] GitHub Token (for build pipeline)"
echo ""
echo "  This is a Personal Access Token (classic) with"
echo "  'repo', 'workflow', and 'admin:org' scopes."
echo "  Used to create app repos and trigger GHA builds."
echo ""

read -rp "  GitHub Token (or Enter to skip): " GITHUB_TOKEN
if [ -n "$GITHUB_TOKEN" ]; then
    put_param "github-token" "$GITHUB_TOKEN"
fi
echo ""
STEP=$((STEP + 1))

# ---- GPG Key ----
echo "[${STEP}/${TOTAL}] GPG Signing Key"
echo ""
echo "  Used by flat-manager to sign OSTree commits."
echo ""

read -rp "  Generate new GPG key? [Y/n]: " GEN_GPG
GEN_GPG="${GEN_GPG:-Y}"

if [[ "$GEN_GPG" =~ ^[Yy] ]]; then
    echo "  Generating RSA 4096 GPG key..."

    GPG_HOME=$(mktemp -d)
    gpg --homedir "$GPG_HOME" --batch --gen-key <<GPGEOF
%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: FriendlyHub
Name-Email: signing@friendlyhub.org
Expire-Date: 0
GPGEOF

    KEY_ID=$(gpg --homedir "$GPG_HOME" --list-keys --keyid-format long \
        | grep -A1 'pub' | tail -1 | awk '{print $1}')
    FINGERPRINT=$(gpg --homedir "$GPG_HOME" --list-keys --with-colons \
        | grep '^fpr' | head -1 | cut -d: -f10)

    echo "  Key ID: ${KEY_ID}"
    echo "  Fingerprint: ${FINGERPRINT}"

    GPG_PRIVATE=$(gpg --homedir "$GPG_HOME" --export-secret-keys --armor)
    GPG_PUBLIC=$(gpg --homedir "$GPG_HOME" --export --armor)

    put_param "gpg-private-key" "$GPG_PRIVATE" "SecureString" "Advanced"
    put_param "gpg-public-key" "$GPG_PUBLIC" "SecureString"

    # Show base64-encoded public key for .flatpakrepo GPGKey field
    GPG_PUBLIC_B64=$(gpg --homedir "$GPG_HOME" --export | base64 -w 0)
    echo ""
    echo "  Base64 public key for .flatpakrepo GPGKey field:"
    echo "  ${GPG_PUBLIC_B64}"
    echo ""
    echo "  Save this! You'll need it for the friendlyhub.flatpakrepo file."

    rm -rf "$GPG_HOME"
else
    echo "  Skipping GPG key generation."
    echo "  You can store keys manually:"
    echo "    aws ssm put-parameter --name ${PREFIX}/gpg-private-key --type SecureString --tier Advanced --value <key> --region ${REGION}"
fi
echo ""
STEP=$((STEP + 1))

# ---- Summary ----
echo "[${STEP}/${TOTAL}] Done!"
echo ""
echo "================================================"
echo "  SSM Parameters stored under: ${PREFIX}/"
echo "================================================"
echo ""
echo "  To list them:"
echo "    aws ssm get-parameters-by-path --path ${PREFIX}/ --region ${REGION} --query 'Parameters[].Name' --output table"
echo ""
echo "  Next steps:"
if [ "$STAGE" = "prod" ]; then
    echo "    1. Review/update infra/serverless.yml for prod domains"
    echo "    2. just build && STAGE=prod just deploy"
    echo "    3. Upload friendlyhub.flatpakrepo to the prod S3 bucket"
    echo "    4. Update GitHub org secrets (FRIENDLYHUB_API_URL, FLAT_MANAGER_TOKEN, WEBHOOK_SECRET)"
    echo "    5. Build and deploy frontend: cd web && npm run build"
    echo "    6. aws s3 sync web/dist/ s3://<SPA_BUCKET>/ --delete"
    echo "    7. Run smoke tests (see dev/scratchpad.md)"
    echo ""
    echo "  GitHub Org Secrets to set:"
    echo "    FRIENDLYHUB_API_URL = https://friendlyhub.org"
    echo "    FLAT_MANAGER_TOKEN  = ${FM_JWT}"
    echo "    WEBHOOK_SECRET      = ${FM_WEBHOOK_SECRET}"
else
    echo "    1. cd infra && serverless deploy --stage ${STAGE}"
    echo "    2. Note the API Gateway URL from the deploy output"
    echo "    3. Update your GitHub OAuth App callback URL to:"
    echo "       <API_URL>/api/v1/auth/github/callback"
fi
echo ""

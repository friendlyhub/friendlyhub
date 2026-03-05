#!/usr/bin/env bash
set -euo pipefail

# FriendlyHub AWS Setup
# Generates secrets and stores them as SSM parameters for use by serverless.yml.

STAGE="${1:-dev}"
REGION="${AWS_REGION:-eu-west-1}"
PREFIX="/friendlyhub/${STAGE}"

echo "================================================"
echo "  FriendlyHub Setup - stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "================================================"
echo ""

# Check prerequisites
for cmd in aws openssl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: '${cmd}' is required but not found. Install it first."
        exit 1
    fi
done

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

    aws ssm put-parameter \
        --region "$REGION" \
        --name "${PREFIX}/${name}" \
        --value "$value" \
        --type "$type" \
        --overwrite \
        --output text \
        --query "Version" > /dev/null

    echo "  Stored ${PREFIX}/${name}"
}

# ---- JWT Secret ----
echo "[1/6] JWT Secret"
echo "  Generating a random 64-character secret..."
JWT_SECRET=$(openssl rand -base64 48)
put_param "jwt-secret" "$JWT_SECRET"
echo ""

# ---- GitHub OAuth App ----
echo "[2/6] GitHub OAuth App"
echo ""
echo "  You need a GitHub OAuth App. Create one at:"
echo "    https://github.com/settings/developers -> 'New OAuth App'"
echo ""
echo "  Settings to use:"
echo "    Application name: FriendlyHub (${STAGE})"
echo "    Homepage URL:     https://friendlyhub.org"
echo "    Callback URL:     (you'll update this after deploy with the API Gateway URL)"
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

# ---- flat-manager ----
echo "[3/6] flat-manager"
echo ""
echo "  flat-manager won't be running yet on first deploy."
echo "  Enter a token now (or press Enter to generate one)."
echo ""

read -rp "  flat-manager token [auto-generate]: " FM_TOKEN
if [ -z "$FM_TOKEN" ]; then
    FM_TOKEN=$(openssl rand -hex 32)
    echo "  Generated token: ${FM_TOKEN}"
    echo "  (Save this - you'll need it in flat-manager's config too)"
fi

read -rp "  flat-manager URL [http://localhost:8080]: " FM_URL
FM_URL="${FM_URL:-http://localhost:8080}"

put_param "flat-manager-token" "$FM_TOKEN"
put_param "flat-manager-url" "$FM_URL" "String"
echo ""

# ---- Frontend URL ----
echo "[4/6] Frontend URL"
echo ""
read -rp "  Frontend URL [https://friendlyhub.org]: " FRONTEND_URL
FRONTEND_URL="${FRONTEND_URL:-https://friendlyhub.org}"
put_param "frontend-url" "$FRONTEND_URL" "String"
echo ""

# ---- GitHub Token (for triggering builds) ----
echo "[5/6] GitHub Token (for build pipeline)"
echo ""
echo "  This is a Personal Access Token or GitHub App token with"
echo "  'repo' and 'workflow' permissions, used to trigger GHA builds."
echo "  You can skip this for now and add it when you set up the build pipeline."
echo ""

read -rp "  GitHub Token (or Enter to skip): " GITHUB_TOKEN
if [ -n "$GITHUB_TOKEN" ]; then
    put_param "github-token" "$GITHUB_TOKEN"
fi
echo ""

# ---- Summary ----
echo "[6/6] Done!"
echo ""
echo "================================================"
echo "  SSM Parameters stored under: ${PREFIX}/"
echo "================================================"
echo ""
echo "  To list them:"
echo "    aws ssm get-parameters-by-path --path ${PREFIX}/ --region ${REGION} --query 'Parameters[].Name' --output table"
echo ""
echo "  Next steps:"
echo "    1. cd infra && serverless deploy --stage ${STAGE}"
echo "    2. Note the API Gateway URL from the deploy output"
echo "    3. Update your GitHub OAuth App callback URL to:"
echo "       <API_URL>/api/v1/auth/github/callback"
echo ""

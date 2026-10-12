set dotenv-load := false
set shell := ["bash", "-lc"]

region := env("AWS_REGION", "eu-west-1")
cf_spa := env("CF_SPA", "E1GF1AFGUGFYSV")       # CloudFront: FriendlyHub SPA web frontend
cf_repo := env("CF_REPO", "E3RNNYUSDB3TDY")    # CloudFront: OSTree repo
prod_api := "https://p1hegxvj5g.execute-api.eu-west-1.amazonaws.com"

# Build the Lambda binary and package it
build-lambda:
    cd server && cargo lambda build --release
    mkdir -p infra/.build
    cp server/target/lambda/friendlyhub-server/bootstrap infra/.build/
    cd infra/.build && zip -j friendlyhub.zip bootstrap
    rm infra/.build/bootstrap

# Build and deploy to dev
deploy-dev: build-lambda
    cd infra && serverless deploy --stage dev

# Build and deploy to prod, then sync the submissions repo
deploy-prod: build-lambda && sync-submissions
    cd infra && serverless deploy --stage prod

# Push submissions-repo/ to friendlyhub/submissions if it has drifted
sync-submissions:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "$(git status --porcelain submissions-repo)" ]; then
        echo "submissions-repo/ has uncommitted changes; commit them first" >&2
        exit 1
    fi
    sha=$(git log -1 --format=%h -- submissions-repo)
    subject=$(git log -1 --format=%s -- submissions-repo)
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    gh repo clone friendlyhub/submissions "$tmp" -- -q --depth=1
    # Overlay only: the live repo also holds per-app directories from open PRs.
    cp -r submissions-repo/. "$tmp"/
    cd "$tmp"
    if [ -z "$(git status --porcelain)" ]; then
        echo "friendlyhub/submissions is up to date"
        exit 0
    fi
    git status --short
    git add -A
    git commit -q -m "$subject" -m "Synced from submissions-repo/ in friendlyhub/friendlyhub ($sha)."
    git push -q origin main
    echo "friendlyhub/submissions synced to $sha"

# Build and deploy the frontend SPA + docs to S3 (prod)
deploy-web:
    cd web && npm run build
    cd docs && npm run build
    cp -r docs/.vitepress/dist/ web/dist/docs/
    aws s3 sync web/dist/ s3://friendlyhub-prod-spabucket-gbz4esxpwx5u --delete --exclude "setup.sh" --region {{region}}
    # Served as text so the site's "setup script" links open it in the browser instead of downloading it
    aws s3 cp web/dist/setup.sh s3://friendlyhub-prod-spabucket-gbz4esxpwx5u/setup.sh --content-type "text/plain; charset=utf-8" --region {{region}}
    aws cloudfront create-invalidation --distribution-id {{cf_spa}} --paths "/*" --region {{region}}

# Run the Rust server locally
run-server:
    cd server && cargo run

# Run server + frontend dev server
run-dev:
    cd server && cargo run &
    cd web && npm run dev
    wait

# Run frontend dev server against prod API
run-local-against-prod:
    cd web && API_URL={{prod_api}} npm run dev

# Run the docs dev server
run-docs:
    cd docs && npm run dev

# Run server tests
test-server:
    cd server && cargo test

# Run frontend tests
test-web:
    cd web && npm test -- --run

# Run all tests
test-all: test-server test-web

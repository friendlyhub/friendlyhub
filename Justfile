set dotenv-load := false
set shell := ["bash", "-lc"]

region := env("AWS_REGION", "eu-west-1")
cf_spa := env("CF_SPA", "E1GF1AFGUGFYSV")       # CloudFront: FriendlyHub SPA web frontend
cf_repo := env("CF_REPO", "E3RNNYUSDB3TDY")    # CloudFront: OSTree repo

# Build the Lambda binary, zip it, and deploy to dev
deploy-dev: build
    cd infra && serverless deploy --stage dev

# Build the Lambda binary, zip it, and deploy to prod
deploy-prod: build
    cd infra && serverless deploy --stage prod

# Build the Lambda binary and package it
build:
    cd server && cargo lambda build --release
    mkdir -p infra/.build
    cp server/target/lambda/friendlyhub-server/bootstrap infra/.build/
    cd infra/.build && zip -j friendlyhub.zip bootstrap
    rm infra/.build/bootstrap

# Run server tests
test:
    cd server && cargo test

# Run frontend tests
test-web:
    cd web && npm test -- --run

# Run all tests
test-all: test test-web

# Build and run locally
run:
    cd server && cargo run

# Build and deploy the frontend SPA to S3 (prod)
deploy-web:
    cd web && npm run build
    aws s3 sync web/dist/ s3://friendlyhub-prod-spabucket-gbz4esxpwx5u --delete --region {{region}}
    aws cloudfront create-invalidation --distribution-id {{cf_spa}} --paths "/*" --region {{region}}

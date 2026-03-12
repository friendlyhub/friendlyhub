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

# Build and deploy to prod
deploy-prod: build-lambda
    cd infra && serverless deploy --stage prod

# Build and deploy the frontend SPA + docs to S3 (prod)
deploy-web:
    cd web && npm run build
    cd docs && npm run build
    cp -r docs/.vitepress/dist/ web/dist/docs/
    aws s3 sync web/dist/ s3://friendlyhub-prod-spabucket-gbz4esxpwx5u --delete --region {{region}}
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

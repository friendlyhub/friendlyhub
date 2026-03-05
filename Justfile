set dotenv-load := false
set shell := ["bash", "-lc"]

stage := env("STAGE", "dev")
region := env("AWS_REGION", "eu-west-1")

# Build the Lambda binary, zip it, and deploy to AWS
deploy: build
    cd infra && serverless deploy --stage {{stage}}

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

# Set up SSM parameters for a stage
setup:
    ./scripts/setup.sh {{stage}}

# Tear down the deployed stack
destroy:
    cd infra && serverless remove --stage {{stage}}

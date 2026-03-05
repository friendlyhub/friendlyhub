# FriendlyHub

A friendly alternative Flatpak repository at friendlyhub.org.

## Project Structure

Monorepo with the following components:

- `server/` - Rust API server (Axum + sqlx)
- `web/` - React + TypeScript SPA (Vite + Tailwind)
- `infra/` - Serverless Framework V4 (Lambda, API Gateway, Fargate, Aurora, S3, CloudFront)
- `builder-image/` - Docker image for GitHub Actions builds
- `build-templates/` - GitHub Actions workflow templates for app builds
- `deploy/` - flat-manager config, container definitions
- `docs/` - Developer, reviewer, and admin guides
- `dev/` - Local development notes and plans (git-ignored)

## Tech Stack

- **Backend:** Rust, Axum, sqlx (async PostgreSQL)
- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand
- **Database:** PostgreSQL (Aurora Serverless v2). FriendlyHub uses the `friendlyhub` schema; flat-manager uses `public` schema in the same DB.
- **Repo management:** flat-manager (separate Rust process, communicates via HTTP API)
- **Auth:** GitHub OAuth2 + JWT sessions
- **Builds:** GitHub Actions with flatpak-builder
- **Infrastructure:** AWS via Serverless Framework V4 — Lambda (API), ECS Fargate (flat-manager), Aurora Serverless v2, S3, CloudFront
- **Tagging:** All AWS resources must be tagged with `friendlyhub`

## Development

### Server (Rust)
```bash
cd server
cargo build
cargo test
cargo run  # starts API on localhost
```

### Frontend (React)
```bash
cd web
npm install
npm run dev   # starts Vite dev server
npm test
npm run build
```

### Local environment
```bash
docker compose up  # PostgreSQL + flat-manager for local dev
```

## Conventions

- Rust: use `sqlx` with compile-time checked queries, not Diesel
- API routes under `/api/v1/`
- Database migrations in `server/migrations/` using sqlx-cli
- Frontend API client functions in `web/src/api/`
- All FriendlyHub DB tables in the `friendlyhub` PostgreSQL schema
- No emoji in code or docs unless explicitly requested

## GitHub Organization

All repos live under the `friendlyhub` GitHub org:
- `friendlyhub/friendlyhub` — this monorepo
- `friendlyhub/<app-id>` — one repo per Flatpak app (e.g., `friendlyhub/org.example.MyApp`)

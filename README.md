# MOVY

O movimento agora e seu.

MOVY is a modular mobility platform with:

- `backend`: Fastify + TypeScript API with real-time ride orchestration
- `frontend`: Next.js operational dashboard for passenger, driver and admin views
- `mobile`: Expo app for field operations
- `infra`: local and cloud deployment assets
- `docs`: architecture and production notes

## Quick start

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run dev:backend`.
4. In another terminal run `npm run dev:frontend`.
5. Optionally run `npm run dev:mobile`.

## GitHub testing

- The repository is connected to GitHub Actions and the main CI workflow now boots the backend and frontend on the runner before executing smoke tests.
- This gives the team a reproducible "it really started" signal for testing and iterative improvement on every push to `main`, `develop` and pull requests.
- GitHub Actions is used here for validation, not as the final public hosting layer for the platform. Real shared environments should continue through staging and production deploy workflows.

## Local infra

- Local Postgres/Redis: `docker compose -f infra/docker-compose.local.yml up -d`
- Full local stack in containers: `docker compose --profile app -f infra/docker-compose.local.yml up -d`
- Bootstrap Prisma against local Docker Postgres: `npm run prisma:bootstrap:local`
- Staging-like stack: `docker compose --env-file infra/env/staging.env -f infra/docker-compose.staging.yml up -d`

## Production hardening notes

- `JWT_SECRET` must be explicitly configured in production.
- `CORS_ALLOWED_ORIGINS` must list trusted frontend origins in production.
- Dashboard fallback data should be disabled in staging/production with `MOVY_ALLOW_DASHBOARD_FALLBACK=false`.
- The repository now includes runtime Dockerfiles for [`backend/Dockerfile`](./backend/Dockerfile) and [`frontend/Dockerfile`](./frontend/Dockerfile), but production rollout should stay blocked until image publishing, secrets management and observability are wired end to end.

## Persistence modes

- Default local mode: `MOVY_DATA_MODE=memory`
- PostgreSQL mode: set `MOVY_DATA_MODE=prisma`, start Postgres and run:
  - `npm run prisma:bootstrap:local`

The health endpoint exposes the active persistence mode at `/api/health`.
The readiness endpoint exposes whether the app is truly running on PostgreSQL or in fallback mode at `/api/readiness`.

## Local persistent flow

1. `npm install`
2. `npm run infra:local:up`
3. `npm run prisma:bootstrap:local`
4. Update `.env` to `MOVY_DATA_MODE=prisma`
5. `npm run dev:backend`
6. `npm run dev:frontend`
7. `npm run smoke:backend`

## Current environment note

- On this machine, no PostgreSQL server was detected on `localhost:5432`.
- The application is validated and fully runnable in `memory` mode.
- To switch to persistent mode, install/start PostgreSQL, keep `DATABASE_URL` reachable, then run the Prisma commands above.

## Docker image note

- On Windows local builds, the frontend no longer forces `standalone` output by default.
- In Docker image builds, `MOVY_FRONTEND_STANDALONE=true` is enabled inside [`frontend/Dockerfile`](./frontend/Dockerfile) so the runtime image still produces the standalone artifact expected by staging.

## Staging notes

- Use [`infra/docker-compose.staging.yml`](./infra/docker-compose.staging.yml) as the reference stack for a reproducible staging environment.
- Start from [`infra/env/staging.env.example`](./infra/env/staging.env.example), copy it to `infra/env/staging.env` and replace every placeholder secret before use.
- `MOVY_ALLOW_DASHBOARD_FALLBACK` must stay `false` in staging.
- Prefer external managed Postgres/Redis in real staging; the compose file is the fallback reference for reproducibility and smoke validation.
- First staging activation checklist: [`docs/staging-first-deploy.md`](./docs/staging-first-deploy.md)

## Strategic docs

- Product and architecture blueprint: `docs/movy-blueprint.md`
- Execution roadmap: `docs/delivery-plan.md`

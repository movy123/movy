# MOVY PostgreSQL Runbook

## Goal

Turn the backend from fallback `memory` mode into persistent `prisma` mode.

## Required conditions

- PostgreSQL installed or otherwise reachable
- `DATABASE_URL` pointing to a working database
- Port `5432` reachable from the app runtime

## Steps

1. Start local infra with `npm run infra:local:up` or `docker compose -f infra/docker-compose.local.yml up -d`.
2. Set `MOVY_DATA_MODE=prisma` in `.env`.
3. Confirm `DATABASE_URL` is correct.
4. Run `npm run prisma:bootstrap:local`.
5. Start the backend and verify:
   - `/api/health`
   - `/api/readiness`
6. Optional: start the full local container stack with `npm run infra:local:up:app`.

## Expected result

- `/api/health` shows `persistence.mode = prisma`
- `/api/readiness` shows `status = ready`

## Quick rollback

1. Stop the backend.
2. Revert `.env` to `MOVY_DATA_MODE=memory`.
3. Restart the backend.
4. Confirm `/api/readiness` reports `degraded` with fallback memory mode.

## Current blocker in this environment

- No PostgreSQL service or listener was detected on `localhost:5432`
- `psql` is not installed in the current shell environment

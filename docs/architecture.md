# MOVY Architecture

## Core decision

The system is implemented as a modular monorepo:

- Backend API in Fastify with domain-oriented modules
- Next.js frontend for control tower and marketplace experience
- Expo mobile app for operational field flows
- PostgreSQL and Redis prepared in `infra/docker-compose.yml`

Primary integration reference:

- `docs/api-contracts.md` for the currently implemented API request/response contracts

## Backend modules

- `auth`: registration and login
- `drivers`: autonomous driver profile and business controls
- `rides`: request, matching, accept, start, SOS and completion
- `payments`: split calculation and revenue summary
- `reviews`: bilateral reputation
- `notifications`: user event feed

## Persistence behavior

- `memory`: fallback mode used for local validation and offline execution
- `prisma`: PostgreSQL-backed mode selected through `MOVY_DATA_MODE=prisma`
- Migration SQL is scaffolded in `backend/prisma/migrations/0001_init/migration.sql`
- Seed data is available in `backend/prisma/seed.ts`

## Next production steps

- Replace the remaining in-memory-only demo assumptions in the frontend auth flow with a proper session strategy
- Add Redis-backed queues, cache and websocket fan-out
- Integrate payment gateway, KYC provider and mapping stack

## Integration rules now active

- Request correlation uses `x-request-id` on all backend requests.
- Critical write endpoints accept optional `Idempotency-Key` and replay the original response for matching retries:
  - `POST /api/v1/rides`
  - `POST /api/v1/rides/:rideId/complete`
  - `POST /api/v1/support/tickets`
- Reusing the same `Idempotency-Key` with a different payload returns conflict.

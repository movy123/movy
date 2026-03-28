# Render Provisional Deploy

## Goal

Expose MOVY through a real public test link on Render with the smallest safe stack:

- `movy-web` as the public frontend
- `movy-backend` as the API
- managed PostgreSQL
- Prisma migrate + seed on backend deploy

This path is for public testing and iterative improvement, not the final production topology.

## What is validated in code

- The backend now listens on `PORT` when Render injects it.
- Backend readiness returns `200` only with Prisma mode and `503` when it falls back to memory mode.
- The frontend resolves the backend through `MOVY_BACKEND_BASE_URL`, which works with Render internal networking.
- The Render blueprint runs Prisma migration and seed before the backend starts.
- Demo credentials are seeded from environment variables, so frontend and backend stay aligned.

## First Deploy Steps

1. Open Render and create a new Blueprint from the GitHub repository.
2. Confirm that Render detected [`render.yaml`](C:\Users\cledi\Documents\SIST1\SISTE02\movy\render.yaml).
3. When Render prompts for environment values, provide:
   - `CORS_ALLOWED_ORIGINS`: the public URL of the frontend service
   - `MOVY_DEMO_ADMIN_PASSWORD`: choose a non-trivial password
   - `MOVY_DEMO_PASSENGER_PASSWORD`: choose a password for test flows
   - `MOVY_DEMO_DRIVER_PASSWORD`: choose a password for driver flows
4. Create the Blueprint and wait for the first deploy to finish.
5. Copy the frontend public URL from Render. That is the link to access the system.

## Recommended Values

- `CORS_ALLOWED_ORIGINS`: use the Render frontend URL such as `https://movy-web.onrender.com`
- `MOVY_DEMO_ADMIN_EMAIL`: defaults to `admin@movy.local`
- `MOVY_DEMO_PASSENGER_EMAIL`: defaults to `ana@movy.local`
- `MOVY_DEMO_DRIVER_EMAIL`: defaults to `carlos@movy.local`

## Post-Deploy Smoke Checks

- Open the frontend public URL and confirm the home page loads.
- Check backend health at `/api/health`.
- Check backend readiness at `/api/readiness`; it must return `ready`.
- Validate admin login using the configured demo credentials.
- Validate passenger estimate flow in the public UI.
- Validate driver cockpit pages load without fallback errors.

## Rollback

- Use the Render dashboard rollback for `movy-web` and `movy-backend`.
- If the issue is schema-related, restore the previous database state from Render backup or point-in-time recovery before re-enabling traffic.

## Known Limits Of This Provisional Topology

- No centralized metrics or alerting yet.
- No Redis-backed realtime fan-out yet.
- No private backend or WAF layer yet.
- No blue-green release path yet.

## Promotion Criteria

Move beyond this provisional setup only after:

- public smoke tests stay green
- database migrations are stable
- logs and alerts are connected
- staging and production promotion flows are validated

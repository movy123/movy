# MOVY Windows Local Setup

## Installed on this machine

- Git
- ripgrep
- Eclipse Temurin JDK 17
- Android SDK Platform-Tools (`adb`)
- Docker Desktop

## Environment variables configured for the user

- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- PATH entries for Git, Java, ADB and Docker

## Validation commands

- `npm run doctor:windows`
- `npm run start:local`
- `npm run lint`
- `npm run test --workspace backend`
- `npm run build --workspace frontend`

## Current status

- Node and npm are working
- Backend tests are passing
- Monorepo lint is passing
- Frontend build is passing
- Git, Java and ADB were installed successfully
- Docker Desktop and CLI were installed successfully

## Current blocker

Docker Desktop is installed, but the local Docker engine is returning `500 Internal Server Error` on `docker info`.

This is an environment-level issue in Docker Desktop / WSL, not a project code issue. The next recommended action is:

1. Reboot Windows
2. Open Docker Desktop and wait until it shows healthy
3. Run `npm run doctor:windows`
4. Run `npm run start:local`

## After Docker is healthy

1. `npm run dev:backend`
2. `npm run dev:frontend`
3. `npm run dev:mobile`
4. `npm run smoke:backend`

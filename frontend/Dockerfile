FROM node:24-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY mobile/package.json mobile/package.json
RUN npm ci --workspace frontend --include-workspace-root=false

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV MOVY_FRONTEND_STANDALONE=true

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY mobile/package.json mobile/package.json
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/next.config.ts frontend/next.config.ts
COPY frontend/next-env.d.ts frontend/next-env.d.ts
COPY frontend/app frontend/app
COPY --from=deps /app/node_modules ./node_modules

WORKDIR /app/frontend
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((res)=>{if(!res.ok) process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "frontend/server.js"]

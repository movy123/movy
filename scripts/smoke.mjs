import process from "node:process";

const mode = process.argv[2] ?? "all";

const checksByMode = {
  backend: [
    {
      name: "backend health",
      url: process.env.BACKEND_HEALTH_URL ?? "http://127.0.0.1:3333/api/health",
      validate: (payload) => payload?.status === "ok" && payload?.service === "movy-backend"
    },
    {
      name: "backend readiness",
      url: process.env.BACKEND_READINESS_URL ?? "http://127.0.0.1:3333/api/readiness",
      validate: (payload) => ["ready", "degraded"].includes(payload?.status) && payload?.checks?.database
    }
  ],
  frontend: [
    {
      name: "frontend health",
      url: process.env.FRONTEND_HEALTH_URL ?? "http://127.0.0.1:3000/api/health",
      validate: (payload) => payload?.status === "ok" && payload?.service === "movy-frontend"
    }
  ]
};

const checks =
  mode === "all"
    ? [...checksByMode.backend, ...checksByMode.frontend]
    : checksByMode[mode];

if (!checks) {
  console.error(`Unknown smoke mode: ${mode}`);
  process.exit(1);
}

for (const check of checks) {
  const response = await fetch(check.url, {
    headers: {
      "user-agent": "movy-smoke-check"
    }
  });

  if (!response.ok) {
    throw new Error(`${check.name} failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!check.validate(payload)) {
    throw new Error(`${check.name} returned unexpected payload: ${JSON.stringify(payload)}`);
  }

  console.log(`${check.name} ok`);
}

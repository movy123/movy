import process from "node:process";

const required = [
  "SMOKE_FRONTEND_URL",
  "SMOKE_API_URL",
  "SMOKE_PASSENGER_EMAIL",
  "SMOKE_PASSENGER_PASSWORD"
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required smoke env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const frontendUrl = stripTrailingSlash(process.env.SMOKE_FRONTEND_URL);
const apiUrl = stripTrailingSlash(process.env.SMOKE_API_URL);
const smokeEnvName = process.env.SMOKE_ENV_NAME ?? "staging";

await assertJson(`${frontendUrl}/api/health`, (payload) => {
  if (payload.status !== "ok" || payload.service !== "movy-frontend") {
    throw new Error("Frontend health payload is invalid");
  }
});

await assertJson(`${apiUrl}/api/v1/health`, (payload) => {
  if (payload.status !== "ok") {
    throw new Error(`Backend health is not ok: ${payload.status}`);
  }
  if (payload.dependencies?.persistence?.status !== "up") {
    throw new Error("Backend persistence dependency is not healthy");
  }
});

const session = await login(`${apiUrl}/api/v1/auth/login`, process.env.SMOKE_PASSENGER_EMAIL, process.env.SMOKE_PASSENGER_PASSWORD);

await assertAuthorizedJson(`${apiUrl}/api/v1/auth/me`, session.token, (payload) => {
  if (!payload.userId || payload.role !== "PASSENGER") {
    throw new Error("Passenger session validation failed");
  }
});

const estimateResponse = await fetch(`${apiUrl}/api/v1/rides/estimates`, {
  method: "POST",
  headers: jsonHeaders(session.token),
  body: JSON.stringify({
    origin: {
      address: "Paulista",
      lat: -23.563099,
      lng: -46.654419
    },
    destination: {
      address: "Pinheiros",
      lat: -23.56674,
      lng: -46.69297
    },
    type: "INSTANT"
  })
});

if (!estimateResponse.ok) {
  throw new Error(`Estimate smoke failed with status ${estimateResponse.status}`);
}

const estimatePayload = await estimateResponse.json();
if (!estimatePayload.estimate?.id || !estimatePayload.estimate?.suggestedPrice) {
  throw new Error("Estimate payload missing expected fields");
}

console.log(`${smokeEnvName} smoke tests passed`);

async function login(url, email, password) {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email,
      password,
      deviceName: "GitHub Actions Smoke",
      platform: "web"
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  if (response.status === 202) {
    const pending = await response.json();
    if (!pending.challengeId || !pending.codePreview) {
      throw new Error("Smoke credentials require MFA and no non-production code preview is available");
    }

    const verifyResponse = await fetch(url.replace("/auth/login", "/auth/mfa/verify"), {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        challengeId: pending.challengeId,
        code: pending.codePreview
      })
    });

    if (!verifyResponse.ok) {
      throw new Error(`MFA verification failed with status ${verifyResponse.status}`);
    }

    return verifyResponse.json();
  }

  return response.json();
}

async function assertJson(url, validate) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "user-agent": "movy-staging-smoke"
    }
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  validate(await response.json());
}

async function assertAuthorizedJson(url, token, validate) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "user-agent": "movy-staging-smoke"
    }
  });

  if (!response.ok) {
    throw new Error(`Authorized request to ${url} failed with status ${response.status}`);
  }

  validate(await response.json());
}

function jsonHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

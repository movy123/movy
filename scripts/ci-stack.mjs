import process from "node:process";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendPort = process.env.BACKEND_PORT ?? String(await getFreePort());
const frontendPort = process.env.PORT ?? String(await getFreePort());
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const sharedEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "production",
  MOVY_DATA_MODE: process.env.MOVY_DATA_MODE ?? "memory",
  JWT_SECRET: process.env.JWT_SECRET ?? "movy-ci-secret",
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? backendUrl,
  TRUST_PROXY: process.env.TRUST_PROXY ?? "true",
  MOVY_ALLOW_DASHBOARD_FALLBACK: process.env.MOVY_ALLOW_DASHBOARD_FALLBACK ?? "false",
  MOVY_DEMO_ADMIN_EMAIL: process.env.MOVY_DEMO_ADMIN_EMAIL ?? "admin@movy.ci",
  MOVY_DEMO_ADMIN_PASSWORD: process.env.MOVY_DEMO_ADMIN_PASSWORD ?? "admin123",
  MOVY_DEMO_PASSENGER_EMAIL: process.env.MOVY_DEMO_PASSENGER_EMAIL ?? "ana@movy.ci",
  MOVY_DEMO_PASSENGER_PASSWORD: process.env.MOVY_DEMO_PASSENGER_PASSWORD ?? "123456",
  MOVY_DEMO_DRIVER_EMAIL: process.env.MOVY_DEMO_DRIVER_EMAIL ?? "carlos@movy.ci",
  MOVY_DEMO_DRIVER_PASSWORD: process.env.MOVY_DEMO_DRIVER_PASSWORD ?? "123456",
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ?? "120",
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
  HELMET_ENABLED: process.env.HELMET_ENABLED ?? "true",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "warn"
};
const backendEnv = {
  ...sharedEnv,
  PORT: backendPort,
  BACKEND_PORT: backendPort,
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?? frontendUrl
};
const frontendEnv = {
  ...sharedEnv,
  PORT: frontendPort,
  BACKEND_PORT: backendPort,
  MOVY_BACKEND_BASE_URL: process.env.MOVY_BACKEND_BASE_URL ?? backendUrl,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? backendUrl,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? backendUrl
};

const background = [];

try {
  background.push(
    startProcess("backend", process.execPath, [path.join(repoRoot, "backend", "dist", "index.js")], backendEnv, repoRoot),
    startProcess(
      "frontend",
      process.execPath,
      [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "start", "--port", frontendPort],
      frontendEnv,
      path.join(repoRoot, "frontend")
    )
  );

  await waitForJson(`${backendUrl}/api/health`, (payload) => ["ok", "degraded"].includes(payload?.status), "backend health");
  await waitForJson(
    `${backendUrl}/api/readiness`,
    (payload) => ["ready", "degraded"].includes(payload?.status),
    "backend readiness",
    120_000,
    [200, 503]
  );
  await waitForJson(`${frontendUrl}/api/health`, (payload) => payload?.status === "ok", "frontend health");

  await runCommand("smoke", "node", ["scripts/smoke.mjs", "all"], {
    ...frontendEnv,
    BACKEND_HEALTH_URL: `${backendUrl}/api/health`,
    BACKEND_READINESS_URL: `${backendUrl}/api/readiness`,
    FRONTEND_HEALTH_URL: `${frontendUrl}/api/health`
  });
} finally {
  await Promise.allSettled(background.map((proc) => stopProcess(proc)));
}

function startProcess(name, command, args, env, cwd) {
  const spec = resolveCommand(command, args);
  const child = spawn(spec.command, spec.args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  child.stdout.on("data", (chunk) => process.stdout.write(prefixOutput(name, chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefixOutput(name, chunk)));
  child.on("exit", (code, signal) => {
    if (!child.killed && code !== 0) {
      console.error(`[${name}] exited unexpectedly with code ${code ?? "null"} signal ${signal ?? "null"}`);
    }
  });

  return child;
}

async function runCommand(name, command, args, env) {
  await new Promise((resolve, reject) => {
    const spec = resolveCommand(command, args);
    const child = spawn(spec.command, spec.args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    child.stdout.on("data", (chunk) => process.stdout.write(prefixOutput(name, chunk)));
    child.stderr.on("data", (chunk) => process.stderr.write(prefixOutput(name, chunk)));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${name} failed with exit code ${code}`));
    });
  });
}

async function waitForJson(url, validate, label, timeoutMs = 120_000, acceptableStatuses = [200]) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "user-agent": "movy-ci-stack"
        }
      });

      if (acceptableStatuses.includes(response.status)) {
        const payload = await response.json();
        if (validate(payload)) {
          console.log(`[wait] ${label} ok`);
          return;
        }
      }
    } catch {}

    await sleep(2_000);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(10_000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    })
  ]);
}

function prefixOutput(name, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  return lines
    .map((line, index) => {
      if (!line && index === lines.length - 1) {
        return "";
      }

      return `[${name}] ${line}`;
    })
    .join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine free port")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function resolveCommand(command, args) {
  if (process.platform === "win32" && command === "npm") {
    const escaped = [command, ...args].map(escapeWindowsArg).join(" ");
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", escaped]
    };
  }

  return { command, args };
}

function escapeWindowsArg(value) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

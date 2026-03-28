import net from "node:net";
import { URL } from "node:url";

type Environment = "development" | "test" | "production";

export interface AppConfig {
  env: Environment;
  port: number;
  logLevel: string;
  jwtSecret: string;
  corsAllowedOrigins: string[];
  redisUrl: string | undefined;
  trustProxy: boolean;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  helmetEnabled: boolean;
}

export interface DependencyHealth {
  name: string;
  status: "up" | "down" | "skipped";
  detail: string | null;
}

function resolveEnvironment(): Environment {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return process.env.NODE_ENV;
  }

  return "development";
}

function parseAllowedOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

export function readAppConfig(): AppConfig {
  const env = resolveEnvironment();

  return {
    env,
    port: Number(process.env.BACKEND_PORT ?? 3333),
    logLevel: process.env.LOG_LEVEL ?? (env === "production" ? "info" : "debug"),
    jwtSecret: process.env.JWT_SECRET ?? "movy-local-secret",
    corsAllowedOrigins: parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    redisUrl: process.env.REDIS_URL,
    trustProxy: parseBoolean(process.env.TRUST_PROXY, env === "production"),
    rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    helmetEnabled: parseBoolean(process.env.HELMET_ENABLED, true)
  };
}

export function isProduction() {
  return readAppConfig().env === "production";
}

export function assertProductionReadiness(config = readAppConfig()) {
  if (config.env !== "production") {
    return;
  }

  const errors: string[] = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "movy-local-secret") {
    errors.push("JWT_SECRET must be explicitly configured in production");
  }

  if (process.env.MOVY_DATA_MODE === "prisma" && !process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required when MOVY_DATA_MODE=prisma");
  }

  if (config.corsAllowedOrigins.length === 0) {
    errors.push("CORS_ALLOWED_ORIGINS must list allowed origins in production");
  }

  if (!config.trustProxy) {
    errors.push("TRUST_PROXY must be enabled in production behind a load balancer or reverse proxy");
  }

  if (errors.length > 0) {
    throw new Error(`Production readiness check failed: ${errors.join("; ")}`);
  }
}

export function getCorsOriginPolicy() {
  const config = readAppConfig();

  if (config.corsAllowedOrigins.length > 0) {
    return config.corsAllowedOrigins;
  }

  if (config.env === "production") {
    return false;
  }

  return true;
}

export async function checkTcpDependency(name: string, targetUrl: string | undefined, timeoutMs = 1000) {
  if (!targetUrl) {
    return {
      name,
      status: "skipped",
      detail: "not configured"
    } satisfies DependencyHealth;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      name,
      status: "down",
      detail: "invalid URL"
    } satisfies DependencyHealth;
  }

  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "rediss:" ? 6380 : 6379;

  return await new Promise<DependencyHealth>((resolve) => {
    const socket = net.createConnection({ host, port });

    const finalize = (status: DependencyHealth["status"], detail: string | null) => {
      socket.destroy();
      resolve({ name, status, detail });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize("up", `${host}:${port}`));
    socket.once("timeout", () => finalize("down", "timeout"));
    socket.once("error", (error) => finalize("down", error.message));
  });
}

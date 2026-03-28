import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { driverRoutes } from "./modules/drivers/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { reviewRoutes } from "./modules/reviews/routes.js";
import { rideRoutes } from "./modules/rides/routes.js";
import { supportRoutes } from "./modules/support/routes.js";
import { authPlugin } from "./shared/auth.js";
import { checkTcpDependency, getCorsOriginPolicy, readAppConfig } from "./shared/config.js";
import { attachObservabilityHooks } from "./shared/observability.js";
import {
  checkPersistenceHealth,
  getOverview,
  getPersistenceMeta,
  initializePersistence,
  listDrivers,
  listRides
} from "./shared/persistence.js";
import type { Ride } from "./shared/types.js";

export async function buildApp() {
  const appConfig = readAppConfig();
  const startedAt = Date.now();
  await initializePersistence();

  const app = Fastify({
    logger: appConfig.env === "test" ? false : { level: appConfig.logLevel },
    trustProxy: appConfig.trustProxy,
    requestIdHeader: "x-request-id",
    genReqId: (request) => request.headers["x-request-id"]?.toString() ?? randomUUID()
  });

  if (appConfig.helmetEnabled) {
    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    });
  }

  await app.register(cors, {
    origin: getCorsOriginPolicy()
  });
  await app.register(rateLimit, {
    global: true,
    max: appConfig.rateLimitMax,
    timeWindow: appConfig.rateLimitWindowMs,
    skipOnError: false,
    allowList: (request) =>
      request.url.startsWith("/api/health") ||
      request.url.startsWith("/api/v1/health") ||
      request.url.startsWith("/api/readiness") ||
      request.url.startsWith("/api/v1/readiness")
  });
  await app.register(jwt, {
    secret: appConfig.jwtSecret
  });
  await app.register(authPlugin);
  const observability = attachObservabilityHooks(app, startedAt);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  const healthHandler = async () => {
    const persistence = getPersistenceMeta();
    const persistenceHealth = await checkPersistenceHealth();
    const redis = await checkTcpDependency("redis", appConfig.redisUrl);
    const dependencies = {
      persistence: persistenceHealth,
      redis
    };
    const downCount = Object.values(dependencies).filter((dependency) => dependency.status === "down").length;

    return {
      status: downCount === 0 ? "ok" : "degraded",
      service: "movy-backend",
      environment: appConfig.env,
      uptimeMs: observability.getProcessUptimeMs(),
      startedAt: observability.processStartedAt,
      modules: ["auth", "admin", "drivers", "rides", "payments", "reviews", "notifications", "support"],
      persistence,
      dependencies
    };
  };

  const readinessHandler = async (_request: unknown, reply: FastifyReply) => {
    const persistence = getPersistenceMeta();
    const payload = {
      status: persistence.mode === "prisma" ? "ready" : "degraded",
      persistence,
      checks: {
        database: persistence.mode === "prisma" ? "connected" : "fallback-memory"
      }
    };

    return reply.code(payload.status === "ready" ? 200 : 503).send(payload);
  };

  const metricsHandler = async () => {
    const overview = await getOverview();
    return {
      service: "movy-backend",
      environment: appConfig.env,
      uptimeMs: observability.getProcessUptimeMs(),
      requestTracing: {
        requestIdHeader: "x-request-id"
      },
      overview
    };
  };

  app.get("/api/health", healthHandler);
  app.get("/api/v1/health", healthHandler);
  app.get("/api/readiness", readinessHandler);
  app.get("/api/v1/readiness", readinessHandler);
  app.get("/api/metrics", { preHandler: app.requireRole(["ADMIN"]) }, metricsHandler);
  app.get("/api/v1/metrics", { preHandler: app.requireRole(["ADMIN"]) }, metricsHandler);

  app.get("/api/overview", { preHandler: app.requireRole(["ADMIN"]) }, async () => getOverview());
  app.get("/api/v1/overview", { preHandler: app.requireRole(["ADMIN"]) }, async () => getOverview());

  await authRoutes(app, "/api");
  await authRoutes(app, "/api/v1");
  await adminRoutes(app, "/api");
  await adminRoutes(app, "/api/v1");
  await driverRoutes(app, "/api");
  await driverRoutes(app, "/api/v1");
  await rideRoutes(app, "/api");
  await rideRoutes(app, "/api/v1");
  await paymentRoutes(app, "/api");
  await paymentRoutes(app, "/api/v1");
  await reviewRoutes(app, "/api");
  await reviewRoutes(app, "/api/v1");
  await notificationRoutes(app, "/api");
  await notificationRoutes(app, "/api/v1");
  await supportRoutes(app, "/api");
  await supportRoutes(app, "/api/v1");

  return app;
}

export function attachRealtime(app: Awaited<ReturnType<typeof buildApp>>) {
  const io = new Server(app.server, {
    cors: {
      origin: getCorsOriginPolicy()
    }
  });

  io.on("connection", async (socket) => {
    socket.emit("overview", {
      rides: await listRides(),
      drivers: await listDrivers()
    });

    socket.on("ride:subscribe", async (rideId: string) => {
      const ride = (await listRides()).find((item: Ride) => item.id === rideId);
      if (ride) {
        socket.join(rideId);
        socket.emit("ride:update", ride);
      }
    });
  });

  app.addHook("onResponse", async (request) => {
    if (request.url.startsWith("/api/rides") || request.url.startsWith("/api/v1/rides")) {
      io.emit("overview", {
        rides: await listRides(),
        drivers: await listDrivers()
      });
    }
  });

  return io;
}

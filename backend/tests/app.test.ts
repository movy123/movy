import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { store } from "../src/shared/store.js";

let app: Awaited<ReturnType<typeof buildApp>>;

function signWebhookPayload(payload: unknown, secret = process.env.MOVY_PAYMENT_WEBHOOK_SECRET ?? "movy-demo-webhook-secret") {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

async function login(email: string, password: string) {
  const response = await request(app.server).post("/api/v1/auth/login").send({
    email,
    password,
    deviceName: "Vitest",
    platform: "web"
  });
  if (response.status === 202) {
    expect(response.body.challengeId).toBeDefined();
    expect(response.body.codePreview).toBeDefined();
    const verified = await request(app.server).post("/api/v1/auth/mfa/verify").send({
      challengeId: response.body.challengeId,
      code: response.body.codePreview
    });
    expect(verified.status).toBe(200);
    return {
      token: verified.body.token as string,
      refreshToken: verified.body.refreshToken as string
    };
  }

  expect(response.status).toBe(200);
  return {
    token: response.body.token as string,
    refreshToken: response.body.refreshToken as string
  };
}

describe("MOVY backend", () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns service health", async () => {
    const response = await request(app.server).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.persistence.mode).toBeDefined();
    expect(response.body.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(response.body.startedAt).toBeDefined();
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns degraded readiness with 503 while running in memory mode", async () => {
    const response = await request(app.server).get("/api/v1/readiness");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.checks.database).toBe("fallback-memory");
  });

  it("enforces rate limiting while skipping health endpoints", async () => {
    const previousMax = process.env.RATE_LIMIT_MAX;
    const previousWindow = process.env.RATE_LIMIT_WINDOW_MS;
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const limitedApp = await buildApp();
    await limitedApp.ready();

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const health = await request(limitedApp.server).get("/api/v1/health");
        expect(health.status).toBe(200);
      }

      const registerPayload = {
        name: "Rate Limited User",
        email: "rate-limit@movy.local",
        password: "123456",
        role: "PASSENGER"
      };

      const first = await request(limitedApp.server).post("/api/v1/auth/register").send(registerPayload);
      expect(first.status).toBe(201);

      const blocked = await request(limitedApp.server).post("/api/v1/auth/register").send({
        ...registerPayload,
        email: "rate-limit-blocked@movy.local"
      });

      expect(blocked.status).toBe(429);
    } finally {
      await limitedApp.close();
      process.env.RATE_LIMIT_MAX = previousMax;
      process.env.RATE_LIMIT_WINDOW_MS = previousWindow;
    }
  });

  it("creates estimate, books ride and completes lifecycle with session and support flows", async () => {
    const passengerSession = await login("ana@movy.local", "123456");
    const driverSession = await login("carlos@movy.local", "123456");
    const adminSession = await login("admin@movy.local", "admin123");
    const driver = [...store.drivers.values()][0];
    expect(driver).toBeDefined();

    const refresh = await request(app.server).post("/api/v1/auth/refresh").send({
      refreshToken: passengerSession.refreshToken
    });
    expect(refresh.status).toBe(200);
    expect(refresh.body.token).toBeDefined();
    expect(refresh.body.refreshToken).toBeDefined();

    const estimate = await request(app.server)
      .post("/api/v1/rides/estimates")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    expect(estimate.status).toBe(201);
    expect(estimate.body.estimate.id).toBeDefined();
    expect(estimate.body.estimate.suggestedPrice).toBeGreaterThan(0);

    const created = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        estimateId: estimate.body.estimate.id
      });

    expect(created.status).toBe(201);
    expect(created.body.fareEstimate.id).toBe(estimate.body.estimate.id);
    expect(created.body.candidates.length).toBeGreaterThan(0);

    const rideId = created.body.ride.id;
    const matched = await request(app.server)
      .post(`/api/v1/rides/${rideId}/match`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        driverId: driver!.id
      });
    expect(matched.status).toBe(200);
    expect(matched.body.ride.status).toBe("MATCHED");
    expect(matched.body.ride.boardingPin).toHaveLength(4);

    const accepted = await request(app.server)
      .post(`/api/v1/rides/${rideId}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("ACCEPTED");

    const checkin = await request(app.server)
      .post(`/api/v1/rides/${rideId}/checkin-pin`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        pin: matched.body.ride.boardingPin
      });
    expect(checkin.status).toBe(200);
    expect(checkin.body.ride.status).toBe("CHECKED_IN");

    const tracking = await request(app.server)
      .post(`/api/v1/rides/${rideId}/tracking`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({
        lat: -23.564,
        lng: -46.661,
        speedKph: 28
      });
    expect(tracking.status).toBe(200);
    expect(tracking.body.totalPoints).toBeGreaterThan(0);

    const started = await request(app.server)
      .post(`/api/v1/rides/${rideId}/start`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("IN_PROGRESS");

    const completed = await request(app.server)
      .post(`/api/v1/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({
        method: "PIX"
      });
    expect(completed.status).toBe(200);
    expect(completed.body.ride.status).toBe("COMPLETED");
    expect(completed.body.payment.status).toBe("SETTLED");
    expect(completed.body.risk.level).toBeDefined();

    const summary = await request(app.server)
      .get("/api/v1/payments/summary")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.settledTrips).toBeGreaterThan(0);

    const wallet = await request(app.server)
      .get("/api/v1/wallet/me")
      .set("Authorization", `Bearer ${driverSession.token}`);
    expect(wallet.status).toBe(200);
    expect(wallet.body.items.length).toBeGreaterThan(0);

    const events = await request(app.server)
      .get(`/api/v1/rides/${rideId}/events`)
      .set("Authorization", `Bearer ${passengerSession.token}`);
    expect(events.status).toBe(200);
    expect(events.body.events.some((event: { type: string }) => event.type === "PIN_VERIFIED")).toBe(true);
    expect(events.body.tracking.length).toBeGreaterThan(0);

    const ticket = await request(app.server)
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        rideId,
        category: "safety",
        summary: "Solicitacao de revisao da corrida"
      });
    expect(ticket.status).toBe(201);

    const tickets = await request(app.server)
      .get("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(tickets.status).toBe(200);
    expect(tickets.body.items.length).toBeGreaterThan(0);

    const metrics = await request(app.server)
      .get("/api/v1/metrics")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.requestTracing.requestIdHeader).toBe("x-request-id");
    expect(metrics.body.overview.kpis.totalUsers).toBeGreaterThan(0);

    const resolveTicket = await request(app.server)
      .patch(`/api/v1/support/tickets/${ticket.body.id}`)
      .set("Authorization", `Bearer ${adminSession.token}`)
      .send({
        status: "RESOLVED"
      });
    expect(resolveTicket.status).toBe(200);
    expect(resolveTicket.body.status).toBe("RESOLVED");

    const invalidPinRide = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    const invalidPinRideId = invalidPinRide.body.ride.id;
    await request(app.server)
      .post(`/api/v1/rides/${invalidPinRideId}/match`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ driverId: driver!.id });
    await request(app.server)
      .post(`/api/v1/rides/${invalidPinRideId}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    const invalidPin = await request(app.server)
      .post(`/api/v1/rides/${invalidPinRideId}/checkin-pin`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        pin: "0000"
      });
    expect(invalidPin.status).toBe(400);

    const adminTrust = await request(app.server)
      .get("/api/v1/admin/fraud-signals")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(adminTrust.status).toBe(200);
    expect(adminTrust.body.items.some((signal: { type: string }) => signal.type === "INVALID_PIN")).toBe(true);

    const safetyRide = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        origin: {
          address: "Moema",
          lat: -23.599,
          lng: -46.668
        },
        destination: {
          address: "Centro",
          lat: -23.548,
          lng: -46.638
        },
        type: "INSTANT"
      });
    const safetyRideId = safetyRide.body.ride.id;
    await request(app.server)
      .post(`/api/v1/rides/${safetyRideId}/match`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ driverId: driver!.id });
    await request(app.server)
      .post(`/api/v1/rides/${safetyRideId}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    await request(app.server)
      .post(`/api/v1/rides/${safetyRideId}/checkin-pin`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        pin: [...store.rides.values()].find((ride) => ride.id === safetyRideId)!.boardingPin
      });
    await request(app.server)
      .post(`/api/v1/rides/${safetyRideId}/tracking`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({
        lat: -23.57,
        lng: -46.65,
        speedKph: 140
      });
    const sos = await request(app.server)
      .post(`/api/v1/rides/${safetyRideId}/sos`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({});
    expect(sos.status).toBe(200);

    const incidents = await request(app.server)
      .get("/api/v1/admin/incidents")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(incidents.status).toBe(200);
    expect(incidents.body.items.length).toBeGreaterThan(0);

    const acknowledge = await request(app.server)
      .patch(`/api/v1/admin/incidents/${incidents.body.items[0].id}`)
      .set("Authorization", `Bearer ${adminSession.token}`)
      .send({
        status: "ACKNOWLEDGED"
      });
    expect(acknowledge.status).toBe(200);

    const broadcast = await request(app.server)
      .post("/api/v1/notifications/broadcast")
      .set("Authorization", `Bearer ${adminSession.token}`)
      .send({
        title: "Operacao monitorada",
        message: "Central de seguranca reforcada para o turno atual.",
        level: "WARNING"
      });
    expect(broadcast.status).toBe(201);
    expect(broadcast.body.delivered).toBeGreaterThan(0);

    const sessions = await request(app.server)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${passengerSession.token}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.items.length).toBeGreaterThan(0);

    const myNotifications = await request(app.server)
      .get("/api/v1/notifications/me")
      .set("Authorization", `Bearer ${passengerSession.token}`);
    expect(myNotifications.status).toBe(200);
    expect(myNotifications.body.items.length).toBeGreaterThan(0);

    const readNotification = await request(app.server)
      .patch(`/api/v1/notifications/${myNotifications.body.items[0].id}/read`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({});
    expect(readNotification.status).toBe(200);
    expect(readNotification.body.readAt).toBeDefined();

    const review = await request(app.server)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
        rideId,
        reviewedId: [...store.users.values()].find((user) => user.email === "carlos@movy.local")!.id,
        score: 5,
        comment: "Viagem segura e profissional"
      });
    expect(review.status).toBe(201);

    const reputation = await request(app.server)
      .get(
        `/api/v1/reviews/reputation/${[...store.users.values()].find((user) => user.email === "ana@movy.local")!.id}`
      )
      .set("Authorization", `Bearer ${driverSession.token}`);
    expect(reputation.status).toBe(403);

    const adminReputation = await request(app.server)
      .get(
        `/api/v1/reviews/reputation/${[...store.users.values()].find((user) => user.email === "carlos@movy.local")!.id}`
      )
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(adminReputation.status).toBe(200);
    expect(adminReputation.body.reviewsCount).toBeGreaterThan(0);
    expect(adminReputation.body.trustScore).toBeGreaterThan(0);

    const adminUsers = await request(app.server)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(adminUsers.status).toBe(200);
    expect(adminUsers.body.items.length).toBeGreaterThan(0);
    expect(adminUsers.body.items.some((user: { reputation: { trustScore: number } }) => user.reputation.trustScore >= 0)).toBe(
      true
    );

    const myTickets = await request(app.server)
      .get("/api/v1/support/my-tickets")
      .set("Authorization", `Bearer ${passengerSession.token}`);
    expect(myTickets.status).toBe(200);
    expect(myTickets.body.items.length).toBeGreaterThan(0);

    const overview = await request(app.server)
      .get("/api/v1/admin/overview")
      .set("Authorization", `Bearer ${adminSession.token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.security.openFraudSignals).toBeGreaterThan(0);
    expect(overview.body.security.openSafetyIncidents).toBeGreaterThan(0);
    expect(overview.body.operations.mfaProtectedUsers).toBeGreaterThan(0);

    const logout = await request(app.server).post("/api/v1/auth/logout").send({
      refreshToken: refresh.body.refreshToken
    });
    expect(logout.status).toBe(204);
  });

  it("blocks invalid ride lifecycle transitions", async () => {
    const passengerSession = await login("ana@movy.local", "123456");
    const driverSession = await login("carlos@movy.local", "123456");
    const driver = [...store.drivers.values()][0];

    const created = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    expect(created.status).toBe(201);

    const acceptedBeforeMatch = await request(app.server)
      .post(`/api/v1/rides/${created.body.ride.id}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({ driverId: driver!.id });

    expect(acceptedBeforeMatch.status).toBe(409);
    expect(acceptedBeforeMatch.body.code).toBe("INVALID_RIDE_TRANSITION");
  });

  it("keeps direct ride creation compatible for existing clients", async () => {
    const passengerSession = await login("ana@movy.local", "123456");

    const created = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    expect(created.status).toBe(201);
    expect(created.body.ride.id).toBeDefined();
    expect(created.body.estimate.suggestedPrice).toBeGreaterThan(0);
  });

  it("replays idempotent ride creation and completion requests", async () => {
    const passengerSession = await login("ana@movy.local", "123456");
    const driverSession = await login("carlos@movy.local", "123456");
    const driver = [...store.drivers.values()][0];

    const estimate = await request(app.server)
      .post("/api/v1/rides/estimates")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    const createKey = "ride-create-key-1";
    const firstCreate = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .set("Idempotency-Key", createKey)
      .send({
        estimateId: estimate.body.estimate.id
      });
    const secondCreate = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .set("Idempotency-Key", createKey)
      .send({
        estimateId: estimate.body.estimate.id
      });

    expect(firstCreate.status).toBe(201);
    expect(secondCreate.status).toBe(201);
    expect(secondCreate.headers["idempotent-replayed"]).toBe("true");
    expect(secondCreate.body.ride.id).toBe(firstCreate.body.ride.id);

    const rideId = firstCreate.body.ride.id;
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/match`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ driverId: driver!.id });
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/checkin-pin`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ pin: firstCreate.body.ride.boardingPin });
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/start`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});

    const completeKey = "ride-complete-key-1";
    const firstComplete = await request(app.server)
      .post(`/api/v1/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .set("Idempotency-Key", completeKey)
      .send({ method: "PIX" });
    const secondComplete = await request(app.server)
      .post(`/api/v1/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .set("Idempotency-Key", completeKey)
      .send({ method: "PIX" });

    expect(firstComplete.status).toBe(200);
    expect(secondComplete.status).toBe(200);
    expect(secondComplete.headers["idempotent-replayed"]).toBe("true");
    expect(secondComplete.body.payment.id).toBe(firstComplete.body.payment.id);
  });

  it("replays idempotent support ticket creation", async () => {
    const passengerSession = await login("ana@movy.local", "123456");
    const ticketKey = "support-ticket-key-1";

    const firstTicket = await request(app.server)
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .set("Idempotency-Key", ticketKey)
      .send({
        category: "safety",
        summary: "Ticket idempotente para validacao"
      });
    const secondTicket = await request(app.server)
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .set("Idempotency-Key", ticketKey)
      .send({
        category: "safety",
        summary: "Ticket idempotente para validacao"
      });

    expect(firstTicket.status).toBe(201);
    expect(secondTicket.status).toBe(201);
    expect(secondTicket.headers["idempotent-replayed"]).toBe("true");
    expect(secondTicket.body.id).toBe(firstTicket.body.id);
  });

  it("accepts idempotent payment webhooks with signature verification", async () => {
    const webhookPayload = {
      eventId: "provider-event-001",
      eventType: "payment.captured",
      occurredAt: new Date().toISOString(),
      paymentReference: "provider-payment-001",
      amount: 42.5,
      currency: "BRL",
      status: "SETTLED",
      raw: {
        source: "vitest"
      }
    };

    const firstWebhook = await request(app.server)
      .post("/api/v1/webhooks/payments")
      .set("x-provider-name", "demo-gateway")
      .set("x-provider-signature", signWebhookPayload(webhookPayload))
      .send(webhookPayload);
    const secondWebhook = await request(app.server)
      .post("/api/v1/webhooks/payments")
      .set("x-provider-name", "demo-gateway")
      .set("x-provider-signature", signWebhookPayload(webhookPayload))
      .send(webhookPayload);

    expect(firstWebhook.status).toBe(202);
    expect(firstWebhook.body.received).toBe(true);
    expect(firstWebhook.body.acknowledged).toBe(true);
    expect(secondWebhook.status).toBe(202);
    expect(secondWebhook.headers["idempotent-replayed"]).toBe("true");
    expect(secondWebhook.body.eventId).toBe(firstWebhook.body.eventId);
  });

  it("runs payment reconciliation and emits finance discrepancy signals", async () => {
    const passengerSession = await login("ana@movy.local", "123456");
    const driverSession = await login("carlos@movy.local", "123456");
    const adminSession = await login("admin@movy.local", "admin123");
    const driver = [...store.drivers.values()][0];

    const created = await request(app.server)
      .post("/api/v1/rides")
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({
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
      });

    const rideId = created.body.ride.id;
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/match`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ driverId: driver!.id });
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/accept`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/checkin-pin`)
      .set("Authorization", `Bearer ${passengerSession.token}`)
      .send({ pin: created.body.ride.boardingPin });
    await request(app.server)
      .post(`/api/v1/rides/${rideId}/start`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({});
    const completed = await request(app.server)
      .post(`/api/v1/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverSession.token}`)
      .send({ method: "PIX" });

    expect(completed.status).toBe(200);

    const payload = {
      provider: "demo-gateway",
      windowStart: "2020-01-01T00:00:00.000Z",
      windowEnd: "2030-01-01T00:00:00.000Z",
      entries: [
        {
          providerReference: "provider-payment-match-001",
          rideId,
          grossAmount: completed.body.payment.total,
          fees: 0.5,
          netAmount: Number((completed.body.payment.total - 0.5).toFixed(2)),
          status: "SETTLED"
        },
        {
          providerReference: "provider-payment-missing-001",
          rideId: "00000000-0000-0000-0000-000000000001",
          grossAmount: 19.9,
          fees: 0.4,
          netAmount: 19.5,
          status: "SETTLED"
        }
      ]
    };

    const reconciliation = await request(app.server)
      .post("/api/v1/payments/reconciliation")
      .set("Authorization", `Bearer ${adminSession.token}`)
      .set("Idempotency-Key", "reconciliation-key-1")
      .send(payload);

    expect(reconciliation.status).toBe(200);
    expect(reconciliation.body.reportId).toBeDefined();
    expect(reconciliation.body.matched).toBeGreaterThanOrEqual(1);
    expect(reconciliation.body.missingInternal).toBe(1);
    expect(reconciliation.body.discrepancies.some((item: { type: string }) => item.type === "MISSING_INTERNAL")).toBe(true);

    const replayed = await request(app.server)
      .post("/api/v1/payments/reconciliation")
      .set("Authorization", `Bearer ${adminSession.token}`)
      .set("Idempotency-Key", "reconciliation-key-1")
      .send(payload);

    expect(replayed.status).toBe(200);
    expect(replayed.headers["idempotent-replayed"]).toBe("true");
    expect(replayed.body.reportId).toBe(reconciliation.body.reportId);

    const fraudSignals = await request(app.server)
      .get("/api/v1/admin/fraud-signals")
      .set("Authorization", `Bearer ${adminSession.token}`);

    expect(fraudSignals.status).toBe(200);
    expect(fraudSignals.body.items.some((signal: { type: string }) => signal.type === "PAYMENT_MISMATCH")).toBe(true);
  });
});

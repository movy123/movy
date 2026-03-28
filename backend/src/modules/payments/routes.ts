import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { isProduction } from "../../shared/config.js";
import { runIdempotentOperation } from "../../shared/idempotency.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  addAuditLog,
  createFraudSignal,
  getPaymentsSummary,
  getRideById,
  getUserById,
  listPayments,
  listWalletTransactions
} from "../../shared/persistence.js";
import type {
  Payment,
  PaymentReconciliationDiscrepancy,
  PaymentReconciliationEntry,
  PaymentReconciliationReport,
  PaymentWebhookEvent
} from "../../shared/types.js";

const paymentWebhookSchema = z.object({
  eventId: z.string().min(6),
  eventType: z.enum(["payment.authorized", "payment.captured", "payment.failed", "payment.refunded", "payment.chargeback"]),
  occurredAt: z.string().datetime(),
  paymentReference: z.string().min(3),
  rideId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(["PENDING", "SETTLED", "FAILED", "REFUNDED", "CHARGEBACK"]),
  raw: z.unknown().optional()
});

const reconciliationEntrySchema = z.object({
  providerReference: z.string().min(3),
  rideId: z.string().uuid(),
  grossAmount: z.number().nonnegative(),
  fees: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  status: z.enum(["PENDING", "SETTLED", "FAILED", "REFUNDED", "CHARGEBACK"])
});

const reconciliationSchema = z.object({
  provider: z.string().min(2),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  entries: z.array(reconciliationEntrySchema).max(1000)
});

function resolveWebhookSecret() {
  if (process.env.MOVY_PAYMENT_WEBHOOK_SECRET) {
    return process.env.MOVY_PAYMENT_WEBHOOK_SECRET;
  }

  if (isProduction()) {
    return undefined;
  }

  return "movy-demo-webhook-secret";
}

function signWebhookPayload(payload: unknown, secret: string) {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function isTimestampInRange(timestamp: string, start: string, end: string) {
  const value = Date.parse(timestamp);
  return value >= Date.parse(start) && value <= Date.parse(end);
}

function isPaymentMatch(entry: PaymentReconciliationEntry, payment: Payment) {
  return entry.status === payment.status && Number(entry.grossAmount.toFixed(2)) === Number(payment.total.toFixed(2));
}

async function openPaymentMismatchSignal(input: {
  rideId?: string;
  summary: string;
  metadata: Record<string, unknown>;
}) {
  return createFraudSignal({
    rideId: input.rideId,
    type: "PAYMENT_MISMATCH",
    severity: "HIGH",
    summary: input.summary,
    metadata: input.metadata,
    status: "OPEN"
  });
}

export async function paymentRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/payments"), { preHandler: app.requireRole(["ADMIN"]) }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    return paginateItems(await listPayments(), pagination);
  });

  app.get(path("/payments/summary"), { preHandler: app.requireRole(["ADMIN"]) }, async () => getPaymentsSummary());

  app.get(path("/wallet/me"), { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const user = await getUserById(authUser.sub);

    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return {
      balance: user.walletBalance,
      ...(paginateItems(await listWalletTransactions(user.id), parsePaginationQuery(request.query)))
    };
  });

  app.post(path("/webhooks/payments"), async (request, reply) => {
    const provider = request.headers["x-provider-name"]?.toString();
    const signature = request.headers["x-provider-signature"]?.toString();
    const secret = resolveWebhookSecret();

    if (!provider || !signature) {
      return reply.code(400).send({ message: "x-provider-name and x-provider-signature headers are required" });
    }

    if (!secret) {
      return reply.code(503).send({ message: "Payment webhook secret is not configured" });
    }

    const data = paymentWebhookSchema.parse(request.body);
    const expectedSignature = signWebhookPayload(data, secret);

    if (signature !== expectedSignature) {
      return reply.code(401).send({ message: "Invalid webhook signature" });
    }

    const result = await runIdempotentOperation<{
      received: boolean;
      eventId: string;
      provider: string;
      acknowledged: boolean;
      reason?: string;
      processedAt: string;
    }>({
      scope: "payment-webhook",
      key: data.eventId,
      fingerprint: JSON.stringify({
        provider,
        body: data
      }),
      execute: async () => {
        const processedAt = new Date().toISOString();
        const event: PaymentWebhookEvent = {
          ...data,
          provider,
          signatureVerified: true,
          processedAt
        };

        await addAuditLog({
          entityType: "PAYMENT_WEBHOOK",
          entityId: data.eventId,
          action: data.eventType,
          metadata: {
            provider,
            paymentReference: data.paymentReference,
            rideId: data.rideId,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            occurredAt: data.occurredAt,
            signatureVerified: true
          }
        });

        if (data.rideId) {
          const ride = await getRideById(data.rideId);
          if (!ride) {
            await openPaymentMismatchSignal({
              summary: `Provider ${provider} sent payment event for unknown ride`,
              metadata: {
                provider,
                eventId: data.eventId,
                rideId: data.rideId,
                paymentReference: data.paymentReference,
                eventType: data.eventType
              }
            });

            return {
              statusCode: 202,
              body: {
                received: true,
                eventId: event.eventId,
                provider,
                acknowledged: false,
                reason: "RIDE_NOT_FOUND",
                processedAt
              }
            };
          }
        }

        if (["payment.failed", "payment.refunded", "payment.chargeback"].includes(data.eventType)) {
          await openPaymentMismatchSignal({
            rideId: data.rideId,
            summary: `Provider ${provider} reported ${data.eventType} for payment ${data.paymentReference}`,
            metadata: {
              provider,
              eventId: data.eventId,
              paymentReference: data.paymentReference,
              eventType: data.eventType,
              amount: data.amount,
              status: data.status
            }
          });
        }

        return {
          statusCode: 202,
          body: {
            received: true,
            eventId: event.eventId,
            provider,
            acknowledged: true,
            processedAt
          }
        };
      }
    });

    if (result.replayed) {
      reply.header("idempotent-replayed", "true");
    }

    return reply.code(result.statusCode).send(result.body);
  });

  app.post(path("/payments/reconciliation"), { preHandler: app.requireRole(["ADMIN"]) }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const idempotencyKey = request.headers["idempotency-key"]?.toString();
    const data = reconciliationSchema.parse(request.body);

    if (Date.parse(data.windowEnd) < Date.parse(data.windowStart)) {
      return reply.code(400).send({ message: "windowEnd must be greater than or equal to windowStart" });
    }

    const result = await runIdempotentOperation<PaymentReconciliationReport>({
      scope: "payment-reconciliation",
      key: idempotencyKey,
      fingerprint: JSON.stringify(data),
      execute: async () => {
        const internalPayments = (await listPayments()).filter((payment) =>
          isTimestampInRange(payment.createdAt, data.windowStart, data.windowEnd)
        );
        const paymentsByRideId = new Map(internalPayments.map((payment) => [payment.rideId, payment]));
        const providerRideIds = new Set(data.entries.map((entry) => entry.rideId));
        const discrepancies: PaymentReconciliationDiscrepancy[] = [];
        let matched = 0;
        let mismatched = 0;
        let missingInternal = 0;

        for (const entry of data.entries) {
          const internalPayment = paymentsByRideId.get(entry.rideId);
          if (!internalPayment) {
            missingInternal += 1;
            discrepancies.push({
              type: "MISSING_INTERNAL",
              rideId: entry.rideId,
              providerReference: entry.providerReference,
              summary: `Provider entry ${entry.providerReference} does not have a matching internal payment`
            });
            continue;
          }

          if (!isPaymentMatch(entry, internalPayment)) {
            mismatched += 1;
            discrepancies.push({
              type: "MISMATCHED",
              rideId: entry.rideId,
              providerReference: entry.providerReference,
              internalPaymentId: internalPayment.id,
              summary: `Provider entry ${entry.providerReference} differs from internal payment ${internalPayment.id}`
            });
            continue;
          }

          matched += 1;
        }

        const missingProviderPayments = internalPayments.filter((payment) => !providerRideIds.has(payment.rideId));
        const reportId = randomUUID();
        const generatedAt = new Date().toISOString();

        for (const discrepancy of discrepancies) {
          await openPaymentMismatchSignal({
            rideId: discrepancy.rideId,
            summary: discrepancy.summary,
            metadata: {
              reportId,
              provider: data.provider,
              type: discrepancy.type,
              providerReference: discrepancy.providerReference,
              internalPaymentId: discrepancy.internalPaymentId
            }
          });
        }

        for (const payment of missingProviderPayments) {
          discrepancies.push({
            type: "MISSING_PROVIDER",
            rideId: payment.rideId,
            internalPaymentId: payment.id,
            summary: `Internal payment ${payment.id} is missing from provider reconciliation payload`
          });

          await openPaymentMismatchSignal({
            rideId: payment.rideId,
            summary: `Internal payment ${payment.id} is missing from provider reconciliation payload`,
            metadata: {
              reportId,
              provider: data.provider,
              type: "MISSING_PROVIDER",
              internalPaymentId: payment.id
            }
          });
        }

        const report: PaymentReconciliationReport = {
          reportId,
          provider: data.provider,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          matched,
          mismatched,
          missingInternal,
          missingProvider: missingProviderPayments.length,
          generatedAt,
          discrepancies
        };

        await addAuditLog({
          actorId: authUser.sub,
          entityType: "PAYMENT_RECONCILIATION",
          entityId: reportId,
          action: "PAYMENT_RECONCILIATION_RUN",
          metadata: {
            provider: data.provider,
            windowStart: data.windowStart,
            windowEnd: data.windowEnd,
            matched,
            mismatched,
            missingInternal,
            missingProvider: missingProviderPayments.length
          }
        });

        return {
          statusCode: 200,
          body: report
        };
      }
    });

    if (result.replayed) {
      reply.header("idempotent-replayed", "true");
    }

    return reply.code(result.statusCode).send(result.body);
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { runIdempotentOperation } from "../../shared/idempotency.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  acceptRide,
  appendTrackingPoint,
  completeRide,
  createFareEstimateForPassenger,
  createRideFromEstimate,
  createRideRequest,
  matchRide,
  startRide,
  triggerSos,
  verifyBoardingPin
} from "./service.js";
import {
  getDriverByUserId,
  getRideById,
  getRiskScore,
  getUserById,
  listRideEvents,
  listRides,
  listTrackingPoints
} from "../../shared/persistence.js";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(3)
});

const createRideSchema = z.object({
  passengerId: z.string().uuid().optional(),
  origin: locationSchema,
  destination: locationSchema,
  type: z.enum(["INSTANT", "SCHEDULED", "SHARED"]),
  scheduledFor: z.string().datetime().optional()
});

const createRideFromEstimateSchema = z.object({
  passengerId: z.string().uuid().optional(),
  estimateId: z.string().uuid()
});

const paymentSchema = z.object({
  method: z.enum(["PIX", "CARD", "WALLET"])
});

const pinSchema = z.object({
  pin: z.string().length(4)
});

const trackingSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  speedKph: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional()
});

export async function rideRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/rides"), { preHandler: app.authenticate }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    return paginateItems(await listRides(), pagination);
  });
  app.post(path("/rides/estimates"), { preHandler: app.requireRole(["PASSENGER", "ADMIN"]) }, async (request, reply) => {
    const data = createRideSchema.parse(request.body);
    const authUser = getAuthUser(request);
    const passengerId = authUser.role === "PASSENGER" ? authUser.sub : data.passengerId;

    if (!passengerId) {
      return reply.code(400).send({ message: "Passenger is required" });
    }

    const user = await getUserById(passengerId);
    if (!user || user.role !== "PASSENGER") {
      return reply.code(400).send({ message: "Passenger not found" });
    }

    return reply.code(201).send({
      estimate: await createFareEstimateForPassenger({
        ...data,
        passengerId
      })
    });
  });

  app.get(path("/rides/:rideId/events"), { preHandler: app.authenticate }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const ride = await getRideById(rideId);
    const authUser = getAuthUser(request);

    if (!ride) {
      return reply.code(404).send({ message: "Ride not found" });
    }

    if (authUser.role !== "ADMIN" && authUser.sub !== ride.passengerId) {
      const driver = authUser.role === "DRIVER" ? await getDriverByUserId(authUser.sub) : undefined;
      if (!driver || driver.id !== ride.driverId) {
        return reply.code(403).send({ message: "Forbidden" });
      }
    }

    return {
      events: await listRideEvents(rideId),
      risk: await getRiskScore(rideId),
      tracking: await listTrackingPoints(rideId)
    };
  });

  app.post(path("/rides"), { preHandler: app.requireRole(["PASSENGER", "ADMIN"]) }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const idempotencyKey = request.headers["idempotency-key"]?.toString();

    const parsedFromEstimate = createRideFromEstimateSchema.safeParse(request.body);
    if (parsedFromEstimate.success) {
      const passengerId =
        authUser.role === "PASSENGER" ? authUser.sub : parsedFromEstimate.data.passengerId;

      if (!passengerId) {
        return reply.code(400).send({ message: "Passenger is required" });
      }

      const user = await getUserById(passengerId);
      if (!user || user.role !== "PASSENGER") {
        return reply.code(400).send({ message: "Passenger not found" });
      }

      const result = await runIdempotentOperation<unknown>({
        scope: "ride-create",
        key: idempotencyKey,
        fingerprint: JSON.stringify({
          passengerId,
          estimateId: parsedFromEstimate.data.estimateId
        }),
        execute: async () => {
          const created = await createRideFromEstimate({
            estimateId: parsedFromEstimate.data.estimateId,
            passengerId
          });

          if ("error" in created) {
            return {
              statusCode: 400,
              body: { message: created.error }
            };
          }

          return {
            statusCode: 201,
            body: created
          };
        }
      });

      if (result.replayed) {
        reply.header("idempotent-replayed", "true");
      }

      return reply.code(result.statusCode).send(result.body);
    }

    const data = createRideSchema.parse(request.body);
    const passengerId = authUser.role === "PASSENGER" ? authUser.sub : data.passengerId;

    if (!passengerId) {
      return reply.code(400).send({ message: "Passenger is required" });
    }

    const user = await getUserById(passengerId);
    if (!user || user.role !== "PASSENGER") {
      return reply.code(400).send({ message: "Passenger not found" });
    }

    const result = await runIdempotentOperation<unknown>({
      scope: "ride-create",
      key: idempotencyKey,
      fingerprint: JSON.stringify({
        passengerId,
        body: data
      }),
      execute: async () => ({
        statusCode: 201,
        body: await createRideRequest({
          ...data,
          passengerId
        })
      })
    });

    if (result.replayed) {
      reply.header("idempotent-replayed", "true");
    }

    return reply.code(result.statusCode).send(result.body);
  });

  app.post(path("/rides/:rideId/match"), { preHandler: app.requireRole(["PASSENGER", "ADMIN"]) }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const body = (request.body ?? {}) as { driverId?: string };
    const ride = await getRideById(rideId);
    const authUser = getAuthUser(request);

    if (!ride) {
      return reply.code(404).send({ message: "Ride not found" });
    }

    if (authUser.role === "PASSENGER" && ride.passengerId !== authUser.sub) {
      return reply.code(403).send({ message: "Passenger can only match own ride" });
    }

    const result = await matchRide(rideId, body.driverId);
    if (!result) {
      return reply.code(404).send({ message: "Ride not found" });
    }
    if ("error" in result) {
      return reply.code(409).send(result.error);
    }
    return result;
  });

  app.post(path("/rides/:rideId/accept"), { preHandler: app.requireRole(["DRIVER", "ADMIN"]) }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const payload = z.object({ driverId: z.string().uuid().optional() }).parse(request.body ?? {});
    const authUser = getAuthUser(request);
    const driverId = authUser.role === "DRIVER" ? (await getDriverByUserId(authUser.sub))?.id : payload.driverId;

    if (!driverId) {
      return reply.code(400).send({ message: "Driver is required" });
    }

    const result = await acceptRide(rideId, driverId);
    if (!result) {
      return reply.code(404).send({ message: "Ride not found" });
    }
    if ("error" in result) {
      return reply.code(409).send(result.error);
    }
    return result;
  });

  app.post(path("/rides/:rideId/checkin-pin"), { preHandler: app.authenticate }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const data = pinSchema.parse(request.body);
    const authUser = getAuthUser(request);
    const result = await verifyBoardingPin(rideId, data.pin, authUser.sub);

    if ("error" in result) {
      if (typeof result.error === "string") {
        return reply.code(result.error === "Ride not found" ? 404 : 400).send({ message: result.error });
      }
      return reply.code(409).send(result.error);
    }

    return result;
  });

  app.post(path("/rides/:rideId/tracking"), { preHandler: app.authenticate }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const data = trackingSchema.parse(request.body);
    const authUser = getAuthUser(request);
    const ride = await getRideById(rideId);

    if (!ride) {
      return reply.code(404).send({ message: "Ride not found" });
    }

    if (authUser.role !== "ADMIN" && authUser.sub !== ride.passengerId) {
      const driver = authUser.role === "DRIVER" ? await getDriverByUserId(authUser.sub) : undefined;
      if (!driver || driver.id !== ride.driverId) {
        return reply.code(403).send({ message: "Forbidden" });
      }
    }

    const result = await appendTrackingPoint(rideId, authUser.sub, data);
    if (!result) {
      return reply.code(404).send({ message: "Ride not found" });
    }
    return result;
  });

  app.post(path("/rides/:rideId/start"), { preHandler: app.requireRole(["DRIVER", "ADMIN"]) }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const result = await startRide(rideId);
    if (!result) {
      return reply.code(404).send({ message: "Ride not found" });
    }
    if ("error" in result) {
      return reply.code(409).send(result.error);
    }
    return result;
  });

  app.post(path("/rides/:rideId/sos"), { preHandler: app.authenticate }, async (request, reply) => {
    const { rideId } = request.params as { rideId: string };
    const result = await triggerSos(rideId);
    if (!result) {
      return reply.code(404).send({ message: "Ride not found" });
    }
    if ("error" in result) {
      return reply.code(409).send(result.error);
    }
    return result;
  });

  app.post(
    path("/rides/:rideId/complete"),
    { preHandler: app.requireRole(["DRIVER", "ADMIN"]) },
    async (request, reply) => {
      const { rideId } = request.params as { rideId: string };
      const data = paymentSchema.parse(request.body);
      const idempotencyKey = request.headers["idempotency-key"]?.toString();
      const result = await runIdempotentOperation<unknown>({
        scope: "ride-complete",
        key: idempotencyKey,
        fingerprint: JSON.stringify({
          rideId,
          method: data.method
        }),
        execute: async () => {
          const completed = await completeRide(rideId, data.method);

          if (!completed) {
            return {
              statusCode: 404,
              body: { message: "Ride not found" }
            };
          }
          if ("error" in completed) {
            return {
              statusCode: 409,
              body: completed.error
            };
          }

          return {
            statusCode: 200,
            body: completed
          };
        }
      });

      if (result.replayed) {
        reply.header("idempotent-replayed", "true");
      }

      return reply.code(result.statusCode).send(result.body);
    }
  );
}

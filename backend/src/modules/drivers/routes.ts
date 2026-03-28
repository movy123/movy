import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  createVehicle,
  getDriverById,
  getDriverByUserId,
  listDrivers,
  listVehiclesByDriver,
  updateDriver
} from "../../shared/persistence.js";

const updateDriverSchema = z.object({
  basePricePerKm: z.number().positive().optional(),
  coverageRadiusKm: z.number().positive().optional(),
  available: z.boolean().optional(),
  vehicleType: z.string().min(2).optional()
});

const vehicleSchema = z.object({
  make: z.string().min(2),
  model: z.string().min(2),
  color: z.string().min(2),
  plate: z.string().min(6),
  year: z.number().int().min(2000).max(2100),
  verified: z.boolean().default(false)
});

export async function driverRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/drivers"), { preHandler: app.authenticate }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    return paginateItems(await listDrivers(), pagination);
  });

  app.patch(
    path("/drivers/:driverId"),
    { preHandler: app.requireRole(["DRIVER", "ADMIN"]) },
    async (request, reply) => {
      const { driverId } = request.params as { driverId: string };
      const data = updateDriverSchema.parse(request.body);

      const authUser = getAuthUser(request);
      if (authUser.role === "DRIVER") {
        const ownDriver = await getDriverByUserId(authUser.sub);
        if (!ownDriver || ownDriver.id !== driverId) {
          return reply.code(403).send({ message: "Driver can only edit own profile" });
        }
      }

      const driver = await getDriverById(driverId);
      if (!driver) {
        return reply.code(404).send({ message: "Driver not found" });
      }

      return updateDriver(driverId, data);
    }
  );

  app.get(path("/drivers/:driverId/vehicles"), { preHandler: app.authenticate }, async (request, reply) => {
    const { driverId } = request.params as { driverId: string };
    const driver = await getDriverById(driverId);
    const authUser = getAuthUser(request);

    if (!driver) {
      return reply.code(404).send({ message: "Driver not found" });
    }

    if (authUser.role !== "ADMIN" && authUser.sub !== driver.userId) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    const pagination = parsePaginationQuery(request.query);
    return paginateItems(await listVehiclesByDriver(driverId), pagination);
  });

  app.post(
    path("/drivers/:driverId/vehicles"),
    { preHandler: app.requireRole(["DRIVER", "ADMIN"]) },
    async (request, reply) => {
      const { driverId } = request.params as { driverId: string };
      const authUser = getAuthUser(request);
      const payload = vehicleSchema.parse(request.body);
      const driver = await getDriverById(driverId);

      if (!driver) {
        return reply.code(404).send({ message: "Driver not found" });
      }

      if (authUser.role !== "ADMIN" && authUser.sub !== driver.userId) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      return reply.code(201).send(await createVehicle(driverId, payload));
    }
  );
}

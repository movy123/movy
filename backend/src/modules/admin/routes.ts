import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  getOverview,
  getUserReputation,
  listFraudSignals,
  listSafetyIncidents,
  listUsers,
  updateSafetyIncidentStatus
} from "../../shared/persistence.js";

const updateIncidentSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"])
});

export async function adminRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/admin/overview"), { preHandler: app.requireRole(["ADMIN"]) }, async () => getOverview());

  app.get(path("/admin/fraud-signals"), { preHandler: app.requireRole(["ADMIN"]) }, async (request) =>
    paginateItems(await listFraudSignals(), parsePaginationQuery(request.query))
  );

  app.get(path("/admin/incidents"), { preHandler: app.requireRole(["ADMIN"]) }, async (request) =>
    paginateItems(await listSafetyIncidents(), parsePaginationQuery(request.query))
  );

  app.get(path("/admin/users"), { preHandler: app.requireRole(["ADMIN"]) }, async (request) => {
    const users = await listUsers();
    const enriched = await Promise.all(
      users.map(async (user) => ({
        ...user,
        reputation: await getUserReputation(user.id)
      }))
    );

    return paginateItems(enriched, parsePaginationQuery(request.query));
  });

  app.patch(path("/admin/incidents/:incidentId"), { preHandler: app.requireRole(["ADMIN"]) }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };
    const data = updateIncidentSchema.parse(request.body);
    const updated = await updateSafetyIncidentStatus(incidentId, data.status);

    if (!updated) {
      return reply.code(404).send({ message: "Incident not found" });
    }

    return updated;
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { runIdempotentOperation } from "../../shared/idempotency.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  createSupportTicket,
  listSupportTickets,
  listSupportTicketsByOwner,
  updateSupportTicketStatus
} from "../../shared/persistence.js";

const supportTicketSchema = z.object({
  rideId: z.string().uuid().optional(),
  category: z.string().min(3),
  summary: z.string().min(5)
});

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"])
});

export async function supportRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/support/tickets"), { preHandler: app.requireRole(["ADMIN"]) }, async (request) =>
    paginateItems(await listSupportTickets(), parsePaginationQuery(request.query))
  );
  app.get(path("/support/my-tickets"), { preHandler: app.authenticate }, async (request) =>
    paginateItems(await listSupportTicketsByOwner(getAuthUser(request).sub), parsePaginationQuery(request.query))
  );

  app.post(path("/support/tickets"), { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const data = supportTicketSchema.parse(request.body);
    const idempotencyKey = request.headers["idempotency-key"]?.toString();

    const result = await runIdempotentOperation<unknown>({
      scope: "support-ticket-create",
      key: idempotencyKey,
      fingerprint: JSON.stringify({
        ownerId: authUser.sub,
        body: data
      }),
      execute: async () => ({
        statusCode: 201,
        body: await createSupportTicket({
          ownerId: authUser.sub,
          rideId: data.rideId,
          category: data.category,
          status: "OPEN",
          summary: data.summary
        })
      })
    });

    if (result.replayed) {
      reply.header("idempotent-replayed", "true");
    }

    return reply.code(result.statusCode).send(result.body);
  });

  app.patch(path("/support/tickets/:ticketId"), { preHandler: app.requireRole(["ADMIN"]) }, async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const data = updateTicketSchema.parse(request.body);
    const updated = await updateSupportTicketStatus(ticketId, data.status);

    if (!updated) {
      return reply.code(404).send({ message: "Ticket not found" });
    }

    return updated;
  });
}

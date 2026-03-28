import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import { getNotifications, listUsers, markNotificationRead, pushNotification } from "../../shared/persistence.js";

const broadcastSchema = z.object({
  title: z.string().min(3),
  message: z.string().min(5),
  level: z.enum(["INFO", "WARNING", "CRITICAL"]).default("INFO"),
  role: z.enum(["PASSENGER", "DRIVER", "ADMIN"]).optional()
});

export async function notificationRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/notifications/me"), { preHandler: app.authenticate }, async (request) => {
    const authUser = getAuthUser(request);
    return paginateItems(await getNotifications(authUser.sub), parsePaginationQuery(request.query));
  });

  app.get(path("/notifications/:userId"), { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const authUser = getAuthUser(request);
    if (authUser.role !== "ADMIN" && authUser.sub !== userId) {
      return reply.code(403).send({ message: "Forbidden" });
    }
    return paginateItems(await getNotifications(userId), parsePaginationQuery(request.query));
  });

  app.patch(path("/notifications/:notificationId/read"), { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const { notificationId } = request.params as { notificationId: string };
    const updated = await markNotificationRead(authUser.sub, notificationId);

    if (!updated) {
      return reply.code(404).send({ message: "Notification not found" });
    }

    return updated;
  });

  app.post(path("/notifications/broadcast"), { preHandler: app.requireRole(["ADMIN"]) }, async (request, reply) => {
    const data = broadcastSchema.parse(request.body);
    const users = await listUsers();
    const targets = data.role ? users.filter((user) => user.role === data.role) : users;

    await Promise.all(targets.map((user) => pushNotification(user.id, data.title, data.message, data.level)));

    return reply.code(201).send({
      delivered: targets.length
    });
  });
}

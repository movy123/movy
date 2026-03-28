import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { addReview, getUserById, getUserReputation, listReviews } from "../../shared/persistence.js";

const reviewSchema = z.object({
  rideId: z.string().uuid(),
  reviewerId: z.string().uuid().optional(),
  reviewedId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().min(3)
});

export async function reviewRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.get(path("/reviews"), { preHandler: app.requireRole(["ADMIN"]) }, async () => listReviews());

  app.get(path("/reviews/reputation/:userId"), { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const authUser = getAuthUser(request);

    if (authUser.role !== "ADMIN" && authUser.sub !== userId) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    const user = await getUserById(userId);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return getUserReputation(userId);
  });

  app.post(path("/reviews"), { preHandler: app.authenticate }, async (request, reply) => {
    const data = reviewSchema.parse(request.body);
    const authUser = getAuthUser(request);
    const review = await addReview({
      rideId: data.rideId,
      reviewerId: authUser.sub,
      reviewedId: data.reviewedId,
      score: data.score,
      comment: data.comment
    });
    return reply.code(201).send(review);
  });
}

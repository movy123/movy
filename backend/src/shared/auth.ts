import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "./types.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireRole(roles: UserRole[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

}

export interface AuthUser {
  sub: string;
  role: UserRole;
  email: string;
}

export function getAuthUser(request: FastifyRequest) {
  return request.user as AuthUser;
}

export const authPlugin = fp(async (app) => {
  app.decorate("authenticate", async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });

  app.decorate("requireRole", function requireRole(roles: UserRole[]) {
    return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
      await app.authenticate(request, reply);
      if (reply.sent) {
        return;
      }

      if (!roles.includes(getAuthUser(request).role)) {
        reply.code(403).send({ message: "Forbidden" });
      }
    };
  });
});

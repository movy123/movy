import type { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthUser } from "../../shared/auth.js";
import { isProduction } from "../../shared/config.js";
import { paginateItems, parsePaginationQuery } from "../../shared/pagination.js";
import {
  createMfaChallenge,
  createDeviceSession,
  createDriverProfile,
  createUser,
  deleteMfaChallenge,
  deleteDeviceSession,
  getMfaChallengeById,
  getDeviceSessionById,
  getDeviceSessionByRefreshToken,
  getUserById,
  getUserByEmail,
  listDeviceSessionsByUser,
  rotateDeviceSessionRefreshToken,
  updateUserMfa
} from "../../shared/persistence.js";
import { hashOpaqueToken, hashPassword, verifyPassword } from "../../shared/security.js";
import type { DeviceSession, User, UserRole } from "../../shared/types.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["PASSENGER", "DRIVER", "ADMIN"]).default("PASSENGER")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceName: z.string().min(2).default("Unknown device"),
  platform: z.string().min(2).default("web")
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});

const verifyMfaSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6)
});

const toggleMfaSchema = z.object({
  enabled: z.boolean()
});

const revokeSessionSchema = z.object({
  sessionId: z.string().uuid()
});

export async function authRoutes(app: FastifyInstance, prefix = "/api") {
  const path = (route: string) => `${prefix}${route}`;

  app.post(path("/auth/register"), async (request, reply) => {
    const data = registerSchema.parse(request.body);

    if (await getUserByEmail(data.email)) {
      return reply.code(409).send({ message: "Email already registered" });
    }

    const user = await createUser(data.name, data.email, hashPassword(data.password), data.role as UserRole);
    if (user.role === "DRIVER") {
      await createDriverProfile(user.id, {
        businessName: `${user.name} Mobility`,
        basePricePerKm: 3.1,
        coverageRadiusKm: 15,
        vehicleType: "Sedan",
        serviceTypes: ["INSTANT"],
        currentLocation: {
          address: "Centro de Sao Paulo",
          lat: -23.55052,
          lng: -46.633308
        },
        safetyScore: 90
      });
    }

    if (user.mfaEnabled) {
      return reply.code(202).send(await issueMfaChallenge(user.id, "Registration session", "web"));
    }

    return reply.code(201).send(await createAuthenticatedSession(reply, user, "Registration session", "web"));
  });

  app.post(path("/auth/login"), async (request, reply) => {
    const data = loginSchema.parse(request.body);
    const user = await getUserByEmail(data.email);

    if (!user || !verifyPassword(data.password, user.password)) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    if (user.mfaEnabled) {
      return reply.code(202).send(await issueMfaChallenge(user.id, data.deviceName, data.platform));
    }

    return createAuthenticatedSession(reply, user, data.deviceName, data.platform);
  });

  app.post(path("/auth/mfa/verify"), async (request, reply) => {
    const data = verifyMfaSchema.parse(request.body);
    const challenge = await getMfaChallengeById(data.challengeId);

    if (!challenge) {
      return reply.code(404).send({ message: "MFA challenge not found" });
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      await deleteMfaChallenge(challenge.id);
      return reply.code(401).send({ message: "MFA challenge expired" });
    }

    if (challenge.code !== data.code) {
      return reply.code(401).send({ message: "Invalid MFA code" });
    }

    const user = await getUserById(challenge.userId);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    await deleteMfaChallenge(challenge.id);
    return createAuthenticatedSession(reply, user, challenge.deviceName, challenge.platform);
  });

  app.post(path("/auth/refresh"), async (request, reply) => {
    const data = refreshSchema.parse(request.body);
    const session = await getDeviceSessionByRefreshToken(hashOpaqueToken(data.refreshToken));

    if (!session) {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }

    const refreshedUser = await getUserById(session.userId);

    if (!refreshedUser) {
      return reply.code(401).send({ message: "Session user not found" });
    }

    const nextRefreshToken = randomUUID() + randomUUID();
    await rotateDeviceSessionRefreshToken(session.id, hashOpaqueToken(nextRefreshToken));

    const token = await reply.jwtSign({
      sub: refreshedUser.id,
      role: refreshedUser.role,
      email: refreshedUser.email
    });

    return {
      token,
      refreshToken: nextRefreshToken
    };
  });

  app.post(path("/auth/logout"), async (request, reply) => {
    const data = refreshSchema.parse(request.body);
    const session = await getDeviceSessionByRefreshToken(hashOpaqueToken(data.refreshToken));

    if (session) {
      await deleteDeviceSession(session.id);
    }

    return reply.code(204).send();
  });

  app.get(path("/auth/me"), { preHandler: app.authenticate }, async (request) => ({
    userId: getAuthUser(request).sub,
    role: getAuthUser(request).role,
    email: getAuthUser(request).email,
    mfaEnabled: (await getUserById(getAuthUser(request).sub))?.mfaEnabled ?? false
  }));

  app.post(path("/auth/mfa/enroll"), { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const data = toggleMfaSchema.parse(request.body);
    const updated = await updateUserMfa(authUser.sub, data.enabled);

    if (!updated) {
      return reply.code(404).send({ message: "User not found" });
    }

    return {
      user: sanitizeUser(updated),
      mfaEnabled: updated.mfaEnabled
    };
  });

  app.get(path("/auth/sessions"), { preHandler: app.authenticate }, async (request) => {
    const authUser = getAuthUser(request);
    const sessions = await listDeviceSessionsByUser(authUser.sub);
    const safeSessions = sessions.map((session: DeviceSession) => {
      const { refreshToken: _refreshToken, ...safeSession } = session;
      return safeSession;
    });
    return paginateItems(safeSessions, parsePaginationQuery(request.query));
  });

  app.delete(path("/auth/sessions/:sessionId"), { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const { sessionId } = revokeSessionSchema.parse(request.params);
    const session = await getDeviceSessionById(sessionId);

    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    if (session.userId !== authUser.sub && authUser.role !== "ADMIN") {
      return reply.code(403).send({ message: "Forbidden" });
    }

    await deleteDeviceSession(sessionId);
    return reply.code(204).send();
  });
}

function sanitizeUser<T extends { password: string }>(user: T) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

async function createAuthenticatedSession(reply: FastifyReply, user: User, deviceName: string, platform: string) {
  const token = await (
    reply as FastifyReply & {
      jwtSign(payload: { sub: string; role: UserRole; email: string }): Promise<string>;
    }
  ).jwtSign({
    sub: user.id,
    role: user.role,
    email: user.email
  });
  const refreshToken = randomUUID() + randomUUID();
  await createDeviceSession(user.id, hashOpaqueToken(refreshToken), deviceName, platform);

  return {
    user: sanitizeUser(user),
    token,
    refreshToken
  };
}

async function issueMfaChallenge(userId: string, deviceName: string, platform: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challenge = await createMfaChallenge({
    userId,
    code,
    deviceName,
    platform,
    method: "APP",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  });

  return {
    mfaRequired: true,
    challengeId: challenge.id,
    method: challenge.method,
    expiresAt: challenge.expiresAt,
    codePreview: isProduction() ? undefined : challenge.code
  };
}

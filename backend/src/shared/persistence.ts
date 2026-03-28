import {
  PrismaClient,
  Prisma,
  RideStatus as PrismaRideStatus,
  RideType as PrismaRideType,
  PaymentMethod as PrismaPaymentMethod,
  UserRole as PrismaUserRole
} from "@prisma/client";
import { isProduction } from "./config.js";
import { store, haversineKm } from "./store.js";
import type {
  AuditLog,
  DeviceSession,
  DriverProfile,
  FareEstimate,
  FraudSignal,
  Location,
  MatchCandidate,
  MfaChallenge,
  Notification,
  Payment,
  PaymentMethod,
  Review,
  Ride,
  RideEvent,
  RideTrackingPoint,
  RiskScore,
  RideType,
  SafetyIncident,
  SupportTicket,
  User,
  Vehicle,
  WalletTransaction
} from "./types.js";

type PersistenceMode = "memory" | "prisma";
type DriverWithUser = Prisma.DriverProfileGetPayload<{ include: { user: true } }>;

let prisma: PrismaClient | null = null;
let mode: PersistenceMode = "memory";
let fallbackReason = "Prisma not requested";

const parseNumber = (value: Prisma.Decimal | number | string) => Number(value);
const prismaAny = () => prisma as any;

export async function initializePersistence() {
  if (process.env.MOVY_DATA_MODE !== "prisma") {
    mode = "memory";
    fallbackReason = "MOVY_DATA_MODE is not prisma";
    return;
  }

  prisma = new PrismaClient();

  try {
    await prisma.$connect();
    mode = "prisma";
    fallbackReason = "";
  } catch (error) {
    if (isProduction()) {
      throw error;
    }

    mode = "memory";
    fallbackReason = error instanceof Error ? error.message : "Failed to connect to Prisma";
    await prisma.$disconnect().catch(() => undefined);
    prisma = null;
  }
}

export async function shutdownPersistence() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

export function getPersistenceMeta() {
  return {
    mode,
    fallbackReason: mode === "memory" ? fallbackReason : null
  };
}

export async function checkPersistenceHealth() {
  if (mode === "memory") {
    return {
      name: "persistence",
      status: isProduction() ? "down" : "up",
      detail: fallbackReason
    } as const;
  }

  try {
    await prisma!.$queryRaw`SELECT 1`;
    return {
      name: "persistence",
      status: "up",
      detail: "connected"
    } as const;
  } catch (error) {
    return {
      name: "persistence",
      status: "down",
      detail: error instanceof Error ? error.message : "database ping failed"
    } as const;
  }
}

export async function getUserByEmail(email: string) {
  if (mode === "memory") {
    return store.getUserByEmail(email);
  }

  const user = await prisma!.user.findUnique({ where: { email } });
  return user ? mapUser(user) : undefined;
}

export async function listUsers() {
  if (mode === "memory") {
    return [...store.users.values()];
  }

  const users = await prisma!.user.findMany({
    orderBy: { createdAt: "desc" }
  });
  return users.map(mapUser);
}

export async function createDeviceSession(
  userId: string,
  refreshToken: string,
  deviceName: string,
  platform: string
) {
  if (mode === "memory") {
    return store.createDeviceSession({
      userId,
      refreshToken,
      deviceName,
      platform
    });
  }

  const created = await prismaAny().deviceSession.create({
    data: {
      userId,
      refreshTokenHash: refreshToken,
      deviceName,
      platform
    }
  });
  return mapDeviceSession(created as any);
}

export async function listDeviceSessionsByUser(userId: string) {
  if (mode === "memory") {
    return [...store.deviceSessions.values()].filter((session) => session.userId === userId);
  }

  const sessions = await prismaAny().deviceSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" }
  });
  return sessions.map((session: unknown) => mapDeviceSession(session as any));
}

export async function getDeviceSessionByRefreshToken(refreshToken: string) {
  if (mode === "memory") {
    return [...store.deviceSessions.values()].find((session) => session.refreshToken === refreshToken);
  }

  const session = await prismaAny().deviceSession.findFirst({
    where: { refreshTokenHash: refreshToken }
  });
  return session ? mapDeviceSession(session as any) : undefined;
}

export async function touchDeviceSession(sessionId: string) {
  if (mode === "memory") {
    return store.touchDeviceSession(sessionId);
  }

  const updated = await prismaAny().deviceSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() }
  });
  return mapDeviceSession(updated as any);
}

export async function rotateDeviceSessionRefreshToken(sessionId: string, refreshToken: string) {
  if (mode === "memory") {
    return store.updateDeviceSessionRefreshToken(sessionId, refreshToken);
  }

  const updated = await prismaAny().deviceSession.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash: refreshToken,
      lastSeenAt: new Date()
    }
  });
  return mapDeviceSession(updated as any);
}

export async function deleteDeviceSession(sessionId: string) {
  if (mode === "memory") {
    return store.deleteDeviceSession(sessionId);
  }

  await prismaAny().deviceSession.delete({
    where: { id: sessionId }
  });
  return true;
}

export async function getDeviceSessionById(sessionId: string) {
  if (mode === "memory") {
    return store.deviceSessions.get(sessionId);
  }

  const session = await prismaAny().deviceSession.findUnique({
    where: { id: sessionId }
  });
  return session ? mapDeviceSession(session as any) : undefined;
}

export async function createMfaChallenge(input: Omit<MfaChallenge, "id" | "createdAt">) {
  if (mode === "memory") {
    return store.createMfaChallenge(input);
  }

  const created = await prismaAny().mfaChallenge.create({
    data: {
      userId: input.userId,
      code: input.code,
      deviceName: input.deviceName,
      platform: input.platform,
      method: input.method,
      expiresAt: new Date(input.expiresAt)
    }
  });
  return mapMfaChallenge(created as any);
}

export async function getMfaChallengeById(challengeId: string) {
  if (mode === "memory") {
    return store.mfaChallenges.get(challengeId);
  }

  const challenge = await prismaAny().mfaChallenge.findUnique({
    where: { id: challengeId }
  });
  return challenge ? mapMfaChallenge(challenge as any) : undefined;
}

export async function deleteMfaChallenge(challengeId: string) {
  if (mode === "memory") {
    return store.deleteMfaChallenge(challengeId);
  }

  await prismaAny().mfaChallenge.delete({
    where: { id: challengeId }
  });
  return true;
}

export async function getUserById(userId: string) {
  if (mode === "memory") {
    return store.users.get(userId);
  }

  const user = await prisma!.user.findUnique({ where: { id: userId } });
  return user ? mapUser(user) : undefined;
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: User["role"],
  options?: Partial<Pick<User, "mfaEnabled" | "mfaMethod">>
) {
  if (mode === "memory") {
    return store.createUser(name, email, password, role, options);
  }

  const created = await prisma!.user.create({
    data: {
      name,
      email,
      passwordHash: password,
      role: role as PrismaUserRole,
      rating: new Prisma.Decimal(role === "ADMIN" ? 5 : 4.8),
      walletBalance: new Prisma.Decimal(role === "PASSENGER" ? 150 : 0)
    }
  });

  await ensureWallet(created.id, role === "PASSENGER" ? 150 : 0);

  return mapUser(created);
}

export async function updateUserMfa(userId: string, enabled: boolean) {
  if (mode === "memory") {
    return store.updateUser(userId, {
      mfaEnabled: enabled,
      mfaMethod: enabled ? "APP" : undefined
    });
  }

  const user = await prisma!.user.findUnique({ where: { id: userId } });
  if (!user) {
    return undefined;
  }

  return {
    ...mapUser(user),
    mfaEnabled: enabled,
    mfaMethod: enabled ? "APP" : undefined
  };
}

export async function createDriverProfile(
  userId: string,
  input: Omit<DriverProfile, "id" | "userId" | "available" | "kycStatus">
) {
  if (mode === "memory") {
    return store.createDriverProfile(userId, input);
  }

  const created = await prisma!.driverProfile.create({
    data: {
      userId,
      businessName: input.businessName,
      basePricePerKm: new Prisma.Decimal(input.basePricePerKm),
      coverageRadiusKm: new Prisma.Decimal(input.coverageRadiusKm),
      vehicleType: input.vehicleType,
      serviceTypes: input.serviceTypes as unknown as PrismaRideType[],
      currentAddress: input.currentLocation.address,
      currentLat: new Prisma.Decimal(input.currentLocation.lat),
      currentLng: new Prisma.Decimal(input.currentLocation.lng),
      safetyScore: input.safetyScore,
      kycStatus: "VERIFIED",
      available: true
    }
  });

  return mapDriver(created);
}

export async function getDriverById(driverId: string) {
  if (mode === "memory") {
    return store.drivers.get(driverId);
  }

  const driver = await prisma!.driverProfile.findUnique({ where: { id: driverId } });
  return driver ? mapDriver(driver) : undefined;
}

export async function getDriverByUserId(userId: string) {
  if (mode === "memory") {
    return [...store.drivers.values()].find((driver) => driver.userId === userId);
  }

  const driver = await prisma!.driverProfile.findUnique({ where: { userId } });
  return driver ? mapDriver(driver) : undefined;
}

export async function listDrivers() {
  if (mode === "memory") {
    return [...store.drivers.values()].map((driver) => ({
      ...driver,
      user: store.users.get(driver.userId)
    }));
  }

  const drivers = await prisma!.driverProfile.findMany({
    include: {
      user: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return drivers.map((driver: DriverWithUser) => ({
    ...mapDriver(driver),
    user: mapUser(driver.user)
  }));
}

export async function updateDriver(driverId: string, data: Partial<DriverProfile>) {
  if (mode === "memory") {
    const driver = store.drivers.get(driverId);
    if (!driver) {
      return undefined;
    }
    const updated = { ...driver, ...data };
    store.drivers.set(driverId, updated);
    return updated;
  }

  const updated = await prisma!.driverProfile.update({
    where: { id: driverId },
    data: {
      basePricePerKm: data.basePricePerKm === undefined ? undefined : new Prisma.Decimal(data.basePricePerKm),
      coverageRadiusKm:
        data.coverageRadiusKm === undefined ? undefined : new Prisma.Decimal(data.coverageRadiusKm),
      available: data.available,
      vehicleType: data.vehicleType
    }
  });
  return mapDriver(updated);
}

export async function createVehicle(driverId: string, input: Omit<Vehicle, "id" | "driverId" | "createdAt">) {
  if (mode === "memory") {
    return store.createVehicle({
      driverId,
      ...input
    });
  }

  const created = await prismaAny().vehicle.create({
    data: {
      driverId,
      ...input
    }
  });
  return mapVehicle(created);
}

export async function listVehiclesByDriver(driverId: string) {
  if (mode === "memory") {
    return [...store.vehicles.values()].filter((vehicle) => vehicle.driverId === driverId);
  }

  const vehicles = await prismaAny().vehicle.findMany({
    where: { driverId },
    orderBy: { createdAt: "desc" }
  });
  return vehicles.map(mapVehicle);
}

export async function listRides() {
  if (mode === "memory") {
    return [...store.rides.values()];
  }

  const rides = await prisma!.ride.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });
  return rides.map((ride: Parameters<typeof mapRide>[0]) => mapRide(ride));
}

export async function createFareEstimate(payload: Omit<FareEstimate, "id" | "createdAt" | "bookedRideId">) {
  if (mode === "memory") {
    return store.createFareEstimate(payload);
  }

  const created = await prismaAny().fareEstimate.create({
    data: {
      passengerId: payload.passengerId,
      originAddress: payload.origin.address,
      originLat: new Prisma.Decimal(payload.origin.lat),
      originLng: new Prisma.Decimal(payload.origin.lng),
      destinationAddress: payload.destination.address,
      destinationLat: new Prisma.Decimal(payload.destination.lat),
      destinationLng: new Prisma.Decimal(payload.destination.lng),
      type: payload.type,
      scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
      distanceKm: new Prisma.Decimal(payload.distanceKm),
      estimatedMinutes: payload.estimatedMinutes,
      suggestedPrice: new Prisma.Decimal(payload.suggestedPrice),
      minPrice: new Prisma.Decimal(payload.minPrice),
      maxPrice: new Prisma.Decimal(payload.maxPrice),
      riskScore: new Prisma.Decimal(payload.riskScore),
      riskLevel: payload.riskLevel,
      pinRequired: payload.pinRequired,
      expiresAt: new Date(payload.expiresAt)
    }
  });

  return mapFareEstimate(created as any);
}

export async function getFareEstimateById(estimateId: string) {
  if (mode === "memory") {
    return store.fareEstimates.get(estimateId);
  }

  const estimate = await prismaAny().fareEstimate.findUnique({
    where: { id: estimateId }
  });
  return estimate ? mapFareEstimate(estimate as any) : undefined;
}

export async function consumeFareEstimate(estimateId: string, rideId: string) {
  if (mode === "memory") {
    return store.updateFareEstimate(estimateId, { bookedRideId: rideId });
  }

  const updated = await prismaAny().fareEstimate.update({
    where: { id: estimateId },
    data: {
      bookedRideId: rideId
    }
  });
  return mapFareEstimate(updated as any);
}

export async function getRideById(rideId: string) {
  if (mode === "memory") {
    return store.rides.get(rideId);
  }

  const ride = await prisma!.ride.findUnique({ where: { id: rideId } });
  return ride ? mapRide(ride as any) : undefined;
}

export async function createRide(payload: {
  passengerId: string;
  origin: Location;
  destination: Location;
  type: RideType;
  distanceKm: number;
  estimatedMinutes: number;
  suggestedPrice: number;
  scheduledFor?: string;
}) {
  if (mode === "memory") {
    const ride = store.createRide(payload);
    store.recordRideEvent(ride.id, "PIN_GENERATED", payload.passengerId, {
      boardingPin: ride.boardingPin
    });
    return ride;
  }

  const created = await prisma!.ride.create({
    data: {
      passengerId: payload.passengerId,
      originAddress: payload.origin.address,
      originLat: new Prisma.Decimal(payload.origin.lat),
      originLng: new Prisma.Decimal(payload.origin.lng),
      destinationAddr: payload.destination.address,
      destinationLat: new Prisma.Decimal(payload.destination.lat),
      destinationLng: new Prisma.Decimal(payload.destination.lng),
      type: payload.type as PrismaRideType,
      status: PrismaRideStatus.REQUESTED,
      distanceKm: new Prisma.Decimal(payload.distanceKm),
      estimatedMinutes: payload.estimatedMinutes,
      suggestedPrice: new Prisma.Decimal(payload.suggestedPrice),
      scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
      sharingCode: cryptoRandomString(),
      boardingPin: generateBoardingPin()
    }
  });

  const ride = mapRide(created as any);
  await recordRideEvent(ride.id, "REQUESTED", payload.passengerId, {
    type: payload.type,
    suggestedPrice: payload.suggestedPrice
  });
  await recordRideEvent(ride.id, "PIN_GENERATED", payload.passengerId, {
    boardingPin: ride.boardingPin
  });
  return ride;
}

export async function updateRide(rideId: string, partial: Partial<Ride>) {
  if (mode === "memory") {
    return store.updateRide(rideId, partial);
  }

  const updated = await prisma!.ride.update({
    where: { id: rideId },
    data: {
      driverId: partial.driverId,
      status: partial.status as PrismaRideStatus | undefined,
      suggestedPrice:
        partial.suggestedPrice === undefined ? undefined : new Prisma.Decimal(partial.suggestedPrice),
      finalPrice: partial.finalPrice === undefined ? undefined : new Prisma.Decimal(partial.finalPrice),
      sosTriggered: partial.sosTriggered,
      boardingPinVerified: partial.boardingPinVerified
    }
  });

  return mapRide(updated as any);
}

export async function settlePayment(rideId: string, method: PaymentMethod, total: number) {
  if (mode === "memory") {
    return store.settlePayment(rideId, method, total);
  }

  const payment = await prisma!.payment.create({
    data: {
      rideId,
      method: method as PrismaPaymentMethod,
      total: new Prisma.Decimal(total),
      platformFee: new Prisma.Decimal(Number((total * 0.18).toFixed(2))),
      driverNet: new Prisma.Decimal(Number((total * 0.82).toFixed(2))),
      status: "SETTLED"
    }
  });
  return mapPayment(payment);
}

export async function creditDriverWallet(driverId: string, amount: number) {
  if (mode === "memory") {
    const driver = store.drivers.get(driverId);
    if (!driver) {
      return;
    }
    const driverUser = store.users.get(driver.userId);
    if (driverUser) {
      driverUser.walletBalance = Number((driverUser.walletBalance + amount).toFixed(2));
      store.addWalletTransaction({
        userId: driverUser.id,
        rideId: undefined,
        kind: "CREDIT",
        amount,
        description: "Repasse liquido de corrida"
      });
    }
    return;
  }

  const driver = await prisma!.driverProfile.findUnique({ where: { id: driverId } });
  if (!driver) {
    return;
  }

  await prisma!.user.update({
    where: { id: driver.userId },
    data: {
      walletBalance: {
        increment: new Prisma.Decimal(amount)
      }
    }
  });

  await ensureWallet(driver.userId);
  await prismaAny().walletTransaction.create({
    data: {
      userId: driver.userId,
      walletId: (await prismaAny().wallet.findUniqueOrThrow({ where: { userId: driver.userId } })).id,
      kind: "CREDIT",
      amount: new Prisma.Decimal(amount),
      description: "Repasse liquido de corrida"
    }
  });
}

export async function listPayments() {
  if (mode === "memory") {
    return [...store.payments.values()];
  }

  const payments = await prisma!.payment.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });
  return payments.map(mapPayment);
}

export async function getPaymentsSummary() {
  const payments = await listPayments();
  const totalRevenue = payments.reduce((acc: number, payment: Payment) => acc + payment.total, 0);
  const platformRevenue = payments.reduce((acc: number, payment: Payment) => acc + payment.platformFee, 0);
  const driverRevenue = payments.reduce((acc: number, payment: Payment) => acc + payment.driverNet, 0);

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    platformRevenue: Number(platformRevenue.toFixed(2)),
    driverRevenue: Number(driverRevenue.toFixed(2)),
    settledTrips: payments.length
  };
}

export async function recordRideEvent(
  rideId: string,
  type: RideEvent["type"],
  actorId?: string,
  payload?: Record<string, unknown>
) {
  if (mode === "memory") {
    return store.recordRideEvent(rideId, type, actorId, payload);
  }

  const created = await prismaAny().rideEvent.create({
    data: {
      rideId,
      type,
      actorId,
      payload: payload ?? Prisma.JsonNull
    }
  });
  return mapRideEvent(created as any);
}

export async function listRideEvents(rideId: string) {
  if (mode === "memory") {
    return store.rideEvents.get(rideId) ?? [];
  }

  const events = await prismaAny().rideEvent.findMany({
    where: { rideId },
    orderBy: { createdAt: "asc" }
  });
  return events.map((event: unknown) => mapRideEvent(event as any));
}

export async function addTrackingPoint(
  rideId: string,
  point: Omit<RideTrackingPoint, "id" | "rideId" | "recordedAt">
) {
  if (mode === "memory") {
    return store.addTrackingPoint({
      rideId,
      ...point
    });
  }

  const created = await prismaAny().rideTrackingPoint.create({
    data: {
      rideId,
      lat: new Prisma.Decimal(point.lat),
      lng: new Prisma.Decimal(point.lng),
      speedKph: point.speedKph === undefined ? undefined : new Prisma.Decimal(point.speedKph),
      heading: point.heading === undefined ? undefined : new Prisma.Decimal(point.heading)
    }
  });
  return mapTrackingPoint(created as any);
}

export async function listTrackingPoints(rideId: string) {
  if (mode === "memory") {
    return store.trackingPoints.get(rideId) ?? [];
  }

  const points = await prismaAny().rideTrackingPoint.findMany({
    where: { rideId },
    orderBy: { recordedAt: "asc" }
  });
  return points.map((point: unknown) => mapTrackingPoint(point as any));
}

export async function saveRiskScore(rideId: string, score: number, reasons: string[]) {
  if (mode === "memory") {
    return store.saveRiskScore(rideId, score, reasons);
  }

  const created = await prismaAny().riskScore.create({
    data: {
      rideId,
      score: new Prisma.Decimal(score),
      level: score >= 0.7 ? "HIGH" : score >= 0.35 ? "MEDIUM" : "LOW",
      reasons
    }
  });
  return mapRiskScore(created as any);
}

export async function getRiskScore(rideId: string) {
  if (mode === "memory") {
    return store.riskScores.get(rideId);
  }

  const risk = await prismaAny().riskScore.findFirst({
    where: { rideId },
    orderBy: { createdAt: "desc" }
  });
  return risk ? mapRiskScore(risk as any) : undefined;
}

export async function addAuditLog(input: Omit<AuditLog, "id" | "createdAt">) {
  if (mode === "memory") {
    return store.addAuditLog(input);
  }

  const created = await prismaAny().auditLog.create({
    data: {
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata ?? Prisma.JsonNull
    }
  });
  return mapAuditLog(created as any);
}

export async function listWalletTransactions(userId: string) {
  if (mode === "memory") {
    return store.walletTransactions.get(userId) ?? [];
  }

  const transactions = await prismaAny().walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return transactions.map((transaction: unknown) => mapWalletTransaction(transaction as any));
}

export async function createSupportTicket(input: Omit<SupportTicket, "id" | "createdAt">) {
  if (mode === "memory") {
    return store.createSupportTicket(input);
  }

  const created = await prismaAny().supportTicket.create({
    data: input
  });
  return mapSupportTicket(created as any);
}

export async function listSupportTickets() {
  if (mode === "memory") {
    return [...store.supportTickets.values()];
  }

  const tickets = await prismaAny().supportTicket.findMany({
    orderBy: { createdAt: "desc" }
  });
  return tickets.map((ticket: unknown) => mapSupportTicket(ticket as any));
}

export async function listSupportTicketsByOwner(ownerId: string) {
  if (mode === "memory") {
    return [...store.supportTickets.values()]
      .filter((ticket) => ticket.ownerId === ownerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const tickets = await prismaAny().supportTicket.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" }
  });
  return tickets.map((ticket: unknown) => mapSupportTicket(ticket as any));
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicket["status"]) {
  if (mode === "memory") {
    return store.updateSupportTicket(ticketId, status);
  }

  const updated = await prismaAny().supportTicket.update({
    where: { id: ticketId },
    data: { status }
  });
  return mapSupportTicket(updated as any);
}

export async function createFraudSignal(input: Omit<FraudSignal, "id" | "createdAt">) {
  if (mode === "memory") {
    return store.createFraudSignal(input);
  }

  const created = await prismaAny().fraudSignal.create({
    data: {
      rideId: input.rideId,
      userId: input.userId,
      type: input.type,
      severity: input.severity,
      summary: input.summary,
      metadata: input.metadata ?? Prisma.JsonNull,
      status: input.status
    }
  });
  return mapFraudSignal(created as any);
}

export async function listFraudSignals() {
  if (mode === "memory") {
    return [...store.fraudSignals.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const signals = await prismaAny().fraudSignal.findMany({
    orderBy: { createdAt: "desc" }
  });
  return signals.map((signal: unknown) => mapFraudSignal(signal as any));
}

export async function createSafetyIncident(input: Omit<SafetyIncident, "id" | "createdAt" | "updatedAt">) {
  if (mode === "memory") {
    return store.createSafetyIncident(input);
  }

  const created = await prismaAny().safetyIncident.create({
    data: {
      rideId: input.rideId,
      reporterId: input.reporterId,
      type: input.type,
      status: input.status,
      summary: input.summary,
      metadata: input.metadata ?? Prisma.JsonNull
    }
  });
  return mapSafetyIncident(created as any);
}

export async function listSafetyIncidents() {
  if (mode === "memory") {
    return [...store.safetyIncidents.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const incidents = await prismaAny().safetyIncident.findMany({
    orderBy: { updatedAt: "desc" }
  });
  return incidents.map((incident: unknown) => mapSafetyIncident(incident as any));
}

export async function updateSafetyIncidentStatus(ticketId: string, status: SafetyIncident["status"]) {
  if (mode === "memory") {
    return store.updateSafetyIncident(ticketId, { status });
  }

  const updated = await prismaAny().safetyIncident.update({
    where: { id: ticketId },
    data: { status }
  });
  return mapSafetyIncident(updated as any);
}

export async function listReviews() {
  if (mode === "memory") {
    return [...store.reviews.values()];
  }

  const reviews = await prisma!.review.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });
  return reviews.map(mapReview);
}

export async function addReview(input: Omit<Review, "id" | "createdAt">) {
  if (mode === "memory") {
    return store.addReview(input);
  }

  const created = await prisma!.review.create({
    data: {
      rideId: input.rideId,
      reviewerId: input.reviewerId,
      reviewedId: input.reviewedId,
      score: input.score,
      comment: input.comment
    }
  });

  const reviews = await prisma!.review.findMany({
    where: { reviewedId: input.reviewedId },
    select: { score: true }
  });
  const average = reviews.reduce((acc: number, item: { score: number }) => acc + item.score, 0) / reviews.length;
  await prisma!.user.update({
    where: { id: input.reviewedId },
    data: { rating: new Prisma.Decimal(average.toFixed(2)) }
  });

  return mapReview(created);
}

export async function getNotifications(userId: string) {
  if (mode === "memory") {
    return store.notifications.get(userId) ?? [];
  }

  const notifications = await prisma!.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return notifications.map(mapNotification);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (mode === "memory") {
    return store.markNotificationRead(userId, notificationId);
  }

  const updated = await prisma!.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      readAt: new Date()
    }
  });

  if (updated.count === 0) {
    return undefined;
  }

  const notification = await prisma!.notification.findUnique({
    where: { id: notificationId }
  });
  return notification ? mapNotification(notification) : undefined;
}

export async function pushNotification(
  userId: string,
  title: string,
  message: string,
  level: Notification["level"]
) {
  if (mode === "memory") {
    return store.pushNotification(userId, title, message, level);
  }

  const created = await prisma!.notification.create({
    data: {
      userId,
      title,
      message,
      level
    }
  });
  return mapNotification(created);
}

export async function getUserReputation(userId: string) {
  const driverProfile = await getDriverByUserId(userId);
  const [reviews, rides] = await Promise.all([
    listReviews(),
    listRides()
  ]);

  const relatedReviews = reviews.filter((review) => review.reviewedId === userId);
  const relatedRides = rides.filter(
    (ride) => ride.passengerId === userId || (driverProfile ? ride.driverId === driverProfile.id : false)
  );
  const completedTrips = relatedRides.filter((ride) => ride.status === "COMPLETED").length;
  const cancelledTrips = relatedRides.filter((ride) => ride.status === "CANCELLED").length;
  const averageScore =
    relatedReviews.length > 0
      ? Number(
          (
            relatedReviews.reduce((accumulator, review) => accumulator + review.score, 0) /
            relatedReviews.length
          ).toFixed(2)
        )
      : 0;

  return {
    userId,
    reviewsCount: relatedReviews.length,
    averageScore,
    completedTrips,
    cancelledTrips,
    trustScore: Number(
      Math.max(
        0,
        Math.min(100, averageScore * 18 + completedTrips * 2 - cancelledTrips * 5 + (relatedReviews.length > 0 ? 8 : 0))
      ).toFixed(2)
    ),
    recentReviews: relatedReviews.slice(0, 5)
  };
}

export async function getCandidateMatches(ride: Ride): Promise<MatchCandidate[]> {
  if (mode === "memory") {
    return store.getCandidateMatches(ride);
  }

  const drivers = await prisma!.driverProfile.findMany({
    where: {
      available: true,
      serviceTypes: {
        has: ride.type as PrismaRideType
      }
    },
    include: {
      user: true
    }
  });

  return drivers
    .map((driver: DriverWithUser) => {
      const mappedDriver = mapDriver(driver);
      const driverUser = mapUser(driver.user);
      const distanceToPassengerKm = haversineKm(ride.origin, mappedDriver.currentLocation);
      const etaMinutes = Math.max(4, Math.round(distanceToPassengerKm * 3.1));
      const demandMultiplier = ride.type === "SCHEDULED" ? 1.08 : ride.type === "SHARED" ? 0.92 : 1;
      const recommendedPrice = Number(
        ((ride.distanceKm * mappedDriver.basePricePerKm + distanceToPassengerKm * 0.6) * demandMultiplier).toFixed(2)
      );
      const totalScore = Number(
        (100 - distanceToPassengerKm * 2 + driverUser.rating * 6 + mappedDriver.safetyScore * 0.3).toFixed(2)
      );

      return {
        driver: mappedDriver,
        driverUser,
        distanceToPassengerKm: Number(distanceToPassengerKm.toFixed(2)),
        etaMinutes,
        totalScore,
        recommendedPrice
      };
    })
    .sort((left: MatchCandidate, right: MatchCandidate) => right.totalScore - left.totalScore);
}

export async function getOverview() {
  const [rides, drivers, payments] = await Promise.all([listRides(), listDrivers(), listPayments()]);
  const users = await listUsers();
  const vehicles: Vehicle[] =
    mode === "memory"
      ? [...store.vehicles.values()]
      : (await prismaAny().vehicle.findMany()).map((vehicle: unknown) => mapVehicle(vehicle as any));
  const supportTickets =
    mode === "memory"
      ? [...store.supportTickets.values()]
      : (await prismaAny().supportTicket.findMany()).map((ticket: unknown) => mapSupportTicket(ticket as any));
  const sessions: DeviceSession[] =
    mode === "memory"
      ? [...store.deviceSessions.values()]
      : (await prismaAny().deviceSession.findMany()).map((session: unknown) => mapDeviceSession(session as any));
  const tickets: SupportTicket[] = supportTickets;
  const fraudSignals: FraudSignal[] =
    mode === "memory"
      ? [...store.fraudSignals.values()]
      : (await prismaAny().fraudSignal.findMany()).map((signal: unknown) => mapFraudSignal(signal as any));
  const safetyIncidents: SafetyIncident[] =
    mode === "memory"
      ? [...store.safetyIncidents.values()]
      : (await prismaAny().safetyIncident.findMany()).map((incident: unknown) => mapSafetyIncident(incident as any));

  return {
    kpis: {
      totalUsers: users.length,
      activeDrivers: drivers.filter((driver: DriverProfile) => driver.available).length,
      activeRides: rides.filter((ride: Ride) => ["MATCHED", "ACCEPTED", "IN_PROGRESS"].includes(ride.status)).length,
      completedToday: rides.filter((ride: Ride) => ride.status === "COMPLETED").length,
      totalRevenue: Number(payments.reduce((acc: number, payment: Payment) => acc + payment.total, 0).toFixed(2))
    },
    security: {
      verifiedDrivers: drivers.filter((driver: DriverProfile) => driver.kycStatus === "VERIFIED").length,
      openSosAlerts: rides.filter((ride: Ride) => ride.sosTriggered).length,
      openSafetyIncidents: safetyIncidents.filter((incident) => incident.status !== "RESOLVED").length,
      openFraudSignals: fraudSignals.filter((signal) => signal.status !== "RESOLVED").length
    },
    operations: {
      verifiedVehicles: vehicles.filter((vehicle: Vehicle) => vehicle.verified).length,
      openSupportTickets: tickets.filter((ticket: SupportTicket) => ticket.status !== "RESOLVED").length,
      activeSessions: sessions.length,
      mfaProtectedUsers: users.filter((user) => user.mfaEnabled).length
    }
  };
}

function mapUser(user: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: PrismaUserRole;
  rating: Prisma.Decimal;
  walletBalance: Prisma.Decimal;
  mfaEnabled?: boolean;
  createdAt: Date;
}): User {
  const mfaEnabled = user.mfaEnabled ?? user.role === "ADMIN";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: user.passwordHash,
    role: user.role as User["role"],
    rating: parseNumber(user.rating),
    walletBalance: parseNumber(user.walletBalance),
    mfaEnabled,
    mfaMethod: mfaEnabled ? "APP" : undefined,
    createdAt: user.createdAt.toISOString()
  };
}

function mapDriver(driver: {
  id: string;
  userId: string;
  businessName: string;
  basePricePerKm: Prisma.Decimal;
  coverageRadiusKm: Prisma.Decimal;
  available: boolean;
  vehicleType: string;
  serviceTypes: PrismaRideType[];
  currentAddress: string;
  currentLat: Prisma.Decimal;
  currentLng: Prisma.Decimal;
  safetyScore: number;
  kycStatus: string;
}): DriverProfile {
  return {
    id: driver.id,
    userId: driver.userId,
    businessName: driver.businessName,
    basePricePerKm: parseNumber(driver.basePricePerKm),
    coverageRadiusKm: parseNumber(driver.coverageRadiusKm),
    available: driver.available,
    vehicleType: driver.vehicleType,
    serviceTypes: driver.serviceTypes as RideType[],
    currentLocation: {
      address: driver.currentAddress,
      lat: parseNumber(driver.currentLat),
      lng: parseNumber(driver.currentLng)
    },
    safetyScore: driver.safetyScore,
    kycStatus: driver.kycStatus as DriverProfile["kycStatus"]
  };
}

function mapRide(ride: {
  id: string;
  passengerId: string;
  driverId: string | null;
  originAddress: string;
  originLat: Prisma.Decimal;
  originLng: Prisma.Decimal;
  destinationAddr: string;
  destinationLat: Prisma.Decimal;
  destinationLng: Prisma.Decimal;
  type: PrismaRideType;
  status: PrismaRideStatus;
  distanceKm: Prisma.Decimal;
  estimatedMinutes: number;
  suggestedPrice: Prisma.Decimal;
  finalPrice: Prisma.Decimal | null;
  scheduledFor: Date | null;
  sharingCode: string;
  boardingPin: string;
  boardingPinVerified: boolean;
  sosTriggered: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Ride {
  return {
    id: ride.id,
    passengerId: ride.passengerId,
    driverId: ride.driverId ?? undefined,
    origin: {
      address: ride.originAddress,
      lat: parseNumber(ride.originLat),
      lng: parseNumber(ride.originLng)
    },
    destination: {
      address: ride.destinationAddr,
      lat: parseNumber(ride.destinationLat),
      lng: parseNumber(ride.destinationLng)
    },
    type: ride.type as RideType,
    status: ride.status as Ride["status"],
    distanceKm: parseNumber(ride.distanceKm),
    estimatedMinutes: ride.estimatedMinutes,
    suggestedPrice: parseNumber(ride.suggestedPrice),
    finalPrice: ride.finalPrice ? parseNumber(ride.finalPrice) : undefined,
    scheduledFor: ride.scheduledFor?.toISOString(),
    sharingCode: ride.sharingCode,
    boardingPin: ride.boardingPin,
    boardingPinVerified: ride.boardingPinVerified,
    sosTriggered: ride.sosTriggered,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString()
  };
}

function mapFareEstimate(estimate: {
  id: string;
  passengerId: string;
  originAddress: string;
  originLat: Prisma.Decimal;
  originLng: Prisma.Decimal;
  destinationAddress: string;
  destinationLat: Prisma.Decimal;
  destinationLng: Prisma.Decimal;
  type: string;
  scheduledFor: Date | null;
  distanceKm: Prisma.Decimal;
  estimatedMinutes: number;
  suggestedPrice: Prisma.Decimal;
  minPrice: Prisma.Decimal;
  maxPrice: Prisma.Decimal;
  riskScore: Prisma.Decimal;
  riskLevel: string;
  pinRequired: boolean;
  expiresAt: Date;
  bookedRideId: string | null;
  createdAt: Date;
}): FareEstimate {
  return {
    id: estimate.id,
    passengerId: estimate.passengerId,
    origin: {
      address: estimate.originAddress,
      lat: parseNumber(estimate.originLat),
      lng: parseNumber(estimate.originLng)
    },
    destination: {
      address: estimate.destinationAddress,
      lat: parseNumber(estimate.destinationLat),
      lng: parseNumber(estimate.destinationLng)
    },
    type: estimate.type as RideType,
    scheduledFor: estimate.scheduledFor?.toISOString(),
    distanceKm: parseNumber(estimate.distanceKm),
    estimatedMinutes: estimate.estimatedMinutes,
    suggestedPrice: parseNumber(estimate.suggestedPrice),
    minPrice: parseNumber(estimate.minPrice),
    maxPrice: parseNumber(estimate.maxPrice),
    riskScore: parseNumber(estimate.riskScore),
    riskLevel: estimate.riskLevel as FareEstimate["riskLevel"],
    pinRequired: estimate.pinRequired,
    expiresAt: estimate.expiresAt.toISOString(),
    bookedRideId: estimate.bookedRideId ?? undefined,
    createdAt: estimate.createdAt.toISOString()
  };
}

function mapVehicle(vehicle: {
  id: string;
  driverId: string;
  make: string;
  model: string;
  color: string;
  plate: string;
  year: number;
  verified: boolean;
  createdAt: Date;
}): Vehicle {
  return {
    id: vehicle.id,
    driverId: vehicle.driverId,
    make: vehicle.make,
    model: vehicle.model,
    color: vehicle.color,
    plate: vehicle.plate,
    year: vehicle.year,
    verified: vehicle.verified,
    createdAt: vehicle.createdAt.toISOString()
  };
}

function mapPayment(payment: {
  id: string;
  rideId: string;
  method: PrismaPaymentMethod;
  total: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  driverNet: Prisma.Decimal;
  status: string;
  createdAt: Date;
}): Payment {
  return {
    id: payment.id,
    rideId: payment.rideId,
    method: payment.method as PaymentMethod,
    total: parseNumber(payment.total),
    platformFee: parseNumber(payment.platformFee),
    driverNet: parseNumber(payment.driverNet),
    status: payment.status as Payment["status"],
    createdAt: payment.createdAt.toISOString()
  };
}

function mapReview(review: {
  id: string;
  rideId: string;
  reviewerId: string;
  reviewedId: string;
  score: number;
  comment: string;
  createdAt: Date;
}): Review {
  return {
    id: review.id,
    rideId: review.rideId,
    reviewerId: review.reviewerId,
    reviewedId: review.reviewedId,
    score: review.score,
    comment: review.comment,
    createdAt: review.createdAt.toISOString()
  };
}

function mapRideEvent(event: {
  id: string;
  rideId: string;
  type: string;
  actorId: string | null;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
}): RideEvent {
  return {
    id: event.id,
    rideId: event.rideId,
    type: event.type as RideEvent["type"],
    actorId: event.actorId ?? undefined,
    payload: (event.payload as Record<string, unknown> | null) ?? undefined,
    createdAt: event.createdAt.toISOString()
  };
}

function mapRiskScore(risk: {
  id: string;
  rideId: string;
  score: Prisma.Decimal;
  level: string;
  reasons: Prisma.JsonValue;
  createdAt: Date;
}): RiskScore {
  return {
    id: risk.id,
    rideId: risk.rideId,
    score: parseNumber(risk.score),
    level: risk.level as RiskScore["level"],
    reasons: (risk.reasons as string[]) ?? [],
    createdAt: risk.createdAt.toISOString()
  };
}

function mapWalletTransaction(transaction: {
  id: string;
  userId: string;
  rideId: string | null;
  kind: string;
  amount: Prisma.Decimal;
  description: string;
  createdAt: Date;
}): WalletTransaction {
  return {
    id: transaction.id,
    userId: transaction.userId,
    rideId: transaction.rideId ?? undefined,
    kind: transaction.kind as WalletTransaction["kind"],
    amount: parseNumber(transaction.amount),
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString()
  };
}

function mapAuditLog(log: {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): AuditLog {
  return {
    id: log.id,
    actorId: log.actorId ?? undefined,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    metadata: (log.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: log.createdAt.toISOString()
  };
}

function mapDeviceSession(session: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName: string;
  platform: string;
  lastSeenAt: Date;
  createdAt: Date;
}): DeviceSession {
  return {
    id: session.id,
    userId: session.userId,
    refreshToken: session.refreshTokenHash,
    deviceName: session.deviceName,
    platform: session.platform,
    lastSeenAt: session.lastSeenAt.toISOString(),
    createdAt: session.createdAt.toISOString()
  };
}

function mapMfaChallenge(challenge: {
  id: string;
  userId: string;
  code: string;
  deviceName: string;
  platform: string;
  method: string;
  expiresAt: Date;
  createdAt: Date;
}): MfaChallenge {
  return {
    id: challenge.id,
    userId: challenge.userId,
    code: challenge.code,
    deviceName: challenge.deviceName,
    platform: challenge.platform,
    method: challenge.method as MfaChallenge["method"],
    expiresAt: challenge.expiresAt.toISOString(),
    createdAt: challenge.createdAt.toISOString()
  };
}

function mapTrackingPoint(point: {
  id: string;
  rideId: string;
  lat: Prisma.Decimal;
  lng: Prisma.Decimal;
  speedKph: Prisma.Decimal | null;
  heading: Prisma.Decimal | null;
  recordedAt: Date;
}): RideTrackingPoint {
  return {
    id: point.id,
    rideId: point.rideId,
    lat: parseNumber(point.lat),
    lng: parseNumber(point.lng),
    speedKph: point.speedKph ? parseNumber(point.speedKph) : undefined,
    heading: point.heading ? parseNumber(point.heading) : undefined,
    recordedAt: point.recordedAt.toISOString()
  };
}

function mapSupportTicket(ticket: {
  id: string;
  ownerId: string;
  rideId: string | null;
  category: string;
  status: string;
  summary: string;
  createdAt: Date;
}): SupportTicket {
  return {
    id: ticket.id,
    ownerId: ticket.ownerId,
    rideId: ticket.rideId ?? undefined,
    category: ticket.category,
    status: ticket.status as SupportTicket["status"],
    summary: ticket.summary,
    createdAt: ticket.createdAt.toISOString()
  };
}

function mapFraudSignal(signal: {
  id: string;
  rideId: string | null;
  userId: string | null;
  type: string;
  severity: string;
  summary: string;
  metadata: Prisma.JsonValue | null;
  status: string;
  createdAt: Date;
}): FraudSignal {
  return {
    id: signal.id,
    rideId: signal.rideId ?? undefined,
    userId: signal.userId ?? undefined,
    type: signal.type as FraudSignal["type"],
    severity: signal.severity as FraudSignal["severity"],
    summary: signal.summary,
    metadata: (signal.metadata as Record<string, unknown> | null) ?? undefined,
    status: signal.status as FraudSignal["status"],
    createdAt: signal.createdAt.toISOString()
  };
}

function mapSafetyIncident(incident: {
  id: string;
  rideId: string;
  reporterId: string;
  type: string;
  status: string;
  summary: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): SafetyIncident {
  return {
    id: incident.id,
    rideId: incident.rideId,
    reporterId: incident.reporterId,
    type: incident.type as SafetyIncident["type"],
    status: incident.status as SafetyIncident["status"],
    summary: incident.summary,
    metadata: (incident.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString()
  };
}

function mapNotification(notification: {
  id: string;
  userId: string;
  title: string;
  message: string;
  level: string;
  channel?: string | null;
  readAt?: Date | null;
  createdAt: Date;
}): Notification {
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    level: notification.level as Notification["level"],
    channel: (notification.channel as Notification["channel"]) ?? "IN_APP",
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString()
  };
}

function cryptoRandomString() {
  return Math.random().toString(36).slice(2, 10);
}

function generateBoardingPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function ensureWallet(userId: string, initialBalance = 0) {
  if (mode === "memory") {
    return;
  }

  const existing = await prismaAny().wallet.findUnique({ where: { userId } });
  if (!existing) {
    await prismaAny().wallet.create({
      data: {
        userId,
        balance: initialBalance
      }
    });
  }
}

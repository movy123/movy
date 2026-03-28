import { randomUUID } from "node:crypto";
import { hashPassword } from "./security.js";
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
  WalletTransaction,
  UserRole
} from "./types.js";

const now = () => new Date().toISOString();

const defaultLocation = (address: string, lat: number, lng: number): Location => ({
  address,
  lat,
  lng
});

export class MovyStore {
  users = new Map<string, User>();
  drivers = new Map<string, DriverProfile>();
  rides = new Map<string, Ride>();
  fareEstimates = new Map<string, FareEstimate>();
  payments = new Map<string, Payment>();
  reviews = new Map<string, Review>();
  notifications = new Map<string, Notification[]>();
  vehicles = new Map<string, Vehicle>();
  rideEvents = new Map<string, RideEvent[]>();
  riskScores = new Map<string, RiskScore>();
  walletTransactions = new Map<string, WalletTransaction[]>();
  auditLogs = new Map<string, AuditLog>();
  deviceSessions = new Map<string, DeviceSession>();
  trackingPoints = new Map<string, RideTrackingPoint[]>();
  supportTickets = new Map<string, SupportTicket>();
  mfaChallenges = new Map<string, MfaChallenge>();
  fraudSignals = new Map<string, FraudSignal>();
  safetyIncidents = new Map<string, SafetyIncident>();

  constructor() {
    this.seed();
  }

  private seed() {
    const admin = this.createUser("Equipe MOVY", "admin@movy.local", hashPassword("admin123"), "ADMIN", {
      mfaEnabled: true,
      mfaMethod: "APP"
    });
    const passenger = this.createUser("Ana Passageira", "ana@movy.local", hashPassword("123456"), "PASSENGER");
    const driverUser = this.createUser("Carlos Motorista", "carlos@movy.local", hashPassword("123456"), "DRIVER");
    const premiumDriverUser = this.createUser("Fernanda Prime", "fernanda@movy.local", hashPassword("123456"), "DRIVER");

    this.createDriverProfile(driverUser.id, {
      businessName: "Carlos Executivo",
      basePricePerKm: 3.5,
      coverageRadiusKm: 18,
      vehicleType: "Sedan",
      serviceTypes: ["INSTANT", "SCHEDULED"],
      currentLocation: defaultLocation("Av. Paulista, São Paulo", -23.561684, -46.655981),
      safetyScore: 96
    });

    this.createDriverProfile(premiumDriverUser.id, {
      businessName: "Fernanda Select",
      basePricePerKm: 4.2,
      coverageRadiusKm: 24,
      vehicleType: "SUV",
      serviceTypes: ["INSTANT", "SCHEDULED", "SHARED"],
      currentLocation: defaultLocation("Ibirapuera, São Paulo", -23.587416, -46.657634),
      safetyScore: 99
    });

    this.pushNotification(admin.id, "Painel ativo", "Monitoramento operacional inicializado.", "INFO");
    this.pushNotification(passenger.id, "Bem-vinda à MOVY", "Seu perfil está pronto para solicitar viagens.", "INFO");
    this.createVehicle({
      driverId: [...this.drivers.values()][0]!.id,
      make: "Toyota",
      model: "Corolla",
      color: "Prata",
      plate: "MOV1234",
      year: 2021,
      verified: true
    });
  }

  createUser(
    name: string,
    email: string,
    password: string,
    role: UserRole,
    options?: Partial<Pick<User, "mfaEnabled" | "mfaMethod">>
  ) {
    const user: User = {
      id: randomUUID(),
      name,
      email,
      password,
      role,
      rating: role === "ADMIN" ? 5 : 4.8,
      walletBalance: role === "PASSENGER" ? 150 : 0,
      mfaEnabled: options?.mfaEnabled ?? role === "ADMIN",
      mfaMethod: options?.mfaMethod ?? (role === "ADMIN" ? "APP" : undefined),
      createdAt: now()
    };
    this.users.set(user.id, user);
    return user;
  }

  updateUser(userId: string, partial: Partial<User>) {
    const current = this.users.get(userId);
    if (!current) {
      return undefined;
    }

    const updated = {
      ...current,
      ...partial
    };
    this.users.set(userId, updated);
    return updated;
  }

  createDriverProfile(
    userId: string,
    input: Omit<DriverProfile, "id" | "userId" | "available" | "kycStatus">
  ) {
    const driver: DriverProfile = {
      id: randomUUID(),
      userId,
      available: true,
      kycStatus: "VERIFIED",
      ...input
    };
    this.drivers.set(driver.id, driver);
    return driver;
  }

  createRide(payload: {
    passengerId: string;
    origin: Location;
    destination: Location;
    type: RideType;
    distanceKm: number;
    estimatedMinutes: number;
    suggestedPrice: number;
    scheduledFor?: string;
  }) {
    const ride: Ride = {
      id: randomUUID(),
      sharingCode: randomUUID().slice(0, 8),
      boardingPin: String(Math.floor(1000 + Math.random() * 9000)),
      boardingPinVerified: false,
      status: "REQUESTED",
      createdAt: now(),
      updatedAt: now(),
      sosTriggered: false,
      ...payload
    };
    this.rides.set(ride.id, ride);
    this.recordRideEvent(ride.id, "REQUESTED", ride.passengerId, {
      type: ride.type,
      suggestedPrice: ride.suggestedPrice
    });
    return ride;
  }

  createFareEstimate(
    payload: Omit<FareEstimate, "id" | "createdAt" | "bookedRideId">
  ) {
    const estimate: FareEstimate = {
      id: randomUUID(),
      createdAt: now(),
      ...payload
    };
    this.fareEstimates.set(estimate.id, estimate);
    return estimate;
  }

  updateFareEstimate(estimateId: string, partial: Partial<FareEstimate>) {
    const current = this.fareEstimates.get(estimateId);
    if (!current) {
      return undefined;
    }

    const updated: FareEstimate = {
      ...current,
      ...partial
    };
    this.fareEstimates.set(estimateId, updated);
    return updated;
  }

  updateRide(rideId: string, partial: Partial<Ride>) {
    const current = this.rides.get(rideId);
    if (!current) {
      return undefined;
    }
    const updated: Ride = {
      ...current,
      ...partial,
      updatedAt: now()
    };
    this.rides.set(rideId, updated);
    return updated;
  }

  createVehicle(input: Omit<Vehicle, "id" | "createdAt">) {
    const vehicle: Vehicle = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  settlePayment(rideId: string, method: PaymentMethod, total: number) {
    const payment: Payment = {
      id: randomUUID(),
      rideId,
      method,
      total,
      platformFee: Number((total * 0.18).toFixed(2)),
      driverNet: Number((total * 0.82).toFixed(2)),
      status: "SETTLED",
      createdAt: now()
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  recordRideEvent(
    rideId: string,
    type: RideEvent["type"],
    actorId?: string,
    payload?: Record<string, unknown>
  ) {
    const list = this.rideEvents.get(rideId) ?? [];
    const event: RideEvent = {
      id: randomUUID(),
      rideId,
      type,
      actorId,
      payload,
      createdAt: now()
    };
    list.unshift(event);
    this.rideEvents.set(rideId, list);
    return event;
  }

  saveRiskScore(rideId: string, score: number, reasons: string[]) {
    const risk: RiskScore = {
      id: randomUUID(),
      rideId,
      score,
      level: score >= 0.7 ? "HIGH" : score >= 0.35 ? "MEDIUM" : "LOW",
      reasons,
      createdAt: now()
    };
    this.riskScores.set(rideId, risk);
    return risk;
  }

  addWalletTransaction(input: Omit<WalletTransaction, "id" | "createdAt">) {
    const list = this.walletTransactions.get(input.userId) ?? [];
    const transaction: WalletTransaction = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    list.unshift(transaction);
    this.walletTransactions.set(input.userId, list);
    return transaction;
  }

  addAuditLog(input: Omit<AuditLog, "id" | "createdAt">) {
    const log: AuditLog = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.auditLogs.set(log.id, log);
    return log;
  }

  createDeviceSession(input: Omit<DeviceSession, "id" | "createdAt" | "lastSeenAt">) {
    const session: DeviceSession = {
      id: randomUUID(),
      createdAt: now(),
      lastSeenAt: now(),
      ...input
    };
    this.deviceSessions.set(session.id, session);
    return session;
  }

  touchDeviceSession(sessionId: string) {
    const session = this.deviceSessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    const updated = {
      ...session,
      lastSeenAt: now()
    };
    this.deviceSessions.set(sessionId, updated);
    return updated;
  }

  updateDeviceSessionRefreshToken(sessionId: string, refreshToken: string) {
    const session = this.deviceSessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    const updated = {
      ...session,
      refreshToken,
      lastSeenAt: now()
    };
    this.deviceSessions.set(sessionId, updated);
    return updated;
  }

  deleteDeviceSession(sessionId: string) {
    return this.deviceSessions.delete(sessionId);
  }

  createMfaChallenge(input: Omit<MfaChallenge, "id" | "createdAt">) {
    const challenge: MfaChallenge = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.mfaChallenges.set(challenge.id, challenge);
    return challenge;
  }

  deleteMfaChallenge(challengeId: string) {
    return this.mfaChallenges.delete(challengeId);
  }

  addTrackingPoint(input: Omit<RideTrackingPoint, "id" | "recordedAt">) {
    const list = this.trackingPoints.get(input.rideId) ?? [];
    const point: RideTrackingPoint = {
      id: randomUUID(),
      recordedAt: now(),
      ...input
    };
    list.push(point);
    this.trackingPoints.set(input.rideId, list);
    return point;
  }

  createSupportTicket(input: Omit<SupportTicket, "id" | "createdAt">) {
    const ticket: SupportTicket = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.supportTickets.set(ticket.id, ticket);
    return ticket;
  }

  updateSupportTicket(ticketId: string, status: SupportTicket["status"]) {
    const ticket = this.supportTickets.get(ticketId);
    if (!ticket) {
      return undefined;
    }
    const updated = {
      ...ticket,
      status
    };
    this.supportTickets.set(ticketId, updated);
    return updated;
  }

  addReview(input: Omit<Review, "id" | "createdAt">) {
    const review: Review = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.reviews.set(review.id, review);
    return review;
  }

  pushNotification(userId: string, title: string, message: string, level: Notification["level"]) {
    const list = this.notifications.get(userId) ?? [];
    const notification: Notification = {
      id: randomUUID(),
      userId,
      title,
      message,
      level,
      channel: "IN_APP",
      createdAt: now()
    };
    list.unshift(notification);
    this.notifications.set(userId, list);
    return notification;
  }

  markNotificationRead(userId: string, notificationId: string) {
    const list = this.notifications.get(userId) ?? [];
    const index = list.findIndex((notification) => notification.id === notificationId);
    if (index === -1) {
      return undefined;
    }

    const updated: Notification = {
      ...list[index]!,
      readAt: now()
    };
    list[index] = updated;
    this.notifications.set(userId, list);
    return updated;
  }

  createFraudSignal(input: Omit<FraudSignal, "id" | "createdAt">) {
    const signal: FraudSignal = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.fraudSignals.set(signal.id, signal);
    return signal;
  }

  updateFraudSignal(signalId: string, partial: Partial<FraudSignal>) {
    const current = this.fraudSignals.get(signalId);
    if (!current) {
      return undefined;
    }

    const updated = {
      ...current,
      ...partial
    };
    this.fraudSignals.set(signalId, updated);
    return updated;
  }

  createSafetyIncident(input: Omit<SafetyIncident, "id" | "createdAt" | "updatedAt">) {
    const incident: SafetyIncident = {
      id: randomUUID(),
      createdAt: now(),
      updatedAt: now(),
      ...input
    };
    this.safetyIncidents.set(incident.id, incident);
    return incident;
  }

  updateSafetyIncident(incidentId: string, partial: Partial<SafetyIncident>) {
    const current = this.safetyIncidents.get(incidentId);
    if (!current) {
      return undefined;
    }

    const updated = {
      ...current,
      ...partial,
      updatedAt: now()
    };
    this.safetyIncidents.set(incidentId, updated);
    return updated;
  }

  getUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }

  getCandidateMatches(ride: Ride): MatchCandidate[] {
    return [...this.drivers.values()]
      .filter((driver) => driver.available && driver.serviceTypes.includes(ride.type))
      .map((driver) => {
        const driverUser = this.users.get(driver.userId)!;
        const distanceToPassengerKm = haversineKm(ride.origin, driver.currentLocation);
        const etaMinutes = Math.max(4, Math.round(distanceToPassengerKm * 3.1));
        const demandMultiplier = ride.type === "SCHEDULED" ? 1.08 : ride.type === "SHARED" ? 0.92 : 1;
        const recommendedPrice = Number(
          ((ride.distanceKm * driver.basePricePerKm + distanceToPassengerKm * 0.6) * demandMultiplier).toFixed(2)
        );
        const totalScore = Number(
          (
            100 -
            distanceToPassengerKm * 2 +
            driverUser.rating * 6 +
            driver.safetyScore * 0.3 +
            driver.coverageRadiusKm * 0.2
          ).toFixed(2)
        );

        return {
          driver,
          driverUser,
          distanceToPassengerKm: Number(distanceToPassengerKm.toFixed(2)),
          etaMinutes,
          totalScore,
          recommendedPrice
        };
      })
      .sort((left, right) => right.totalScore - left.totalScore);
  }
}

export const store = new MovyStore();

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(pointA: Location, pointB: Location) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(pointB.lat - pointA.lat);
  const dLng = toRadians(pointB.lng - pointA.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(pointA.lat)) *
      Math.cos(toRadians(pointB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

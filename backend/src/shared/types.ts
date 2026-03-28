export type UserRole = "PASSENGER" | "DRIVER" | "ADMIN";
export type RideType = "INSTANT" | "SCHEDULED" | "SHARED";
export type RideStatus =
  | "REQUESTED"
  | "MATCHED"
  | "ACCEPTED"
  | "ARRIVING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "PIX" | "CARD" | "WALLET";
export type RideEventType =
  | "REQUESTED"
  | "MATCHED"
  | "ACCEPTED"
  | "PIN_GENERATED"
  | "PIN_VERIFIED"
  | "STARTED"
  | "TRACKING_UPDATED"
  | "SOS_TRIGGERED"
  | "COMPLETED";

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  rating: number;
  walletBalance: number;
  mfaEnabled: boolean;
  mfaMethod?: "APP";
  createdAt: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  businessName: string;
  basePricePerKm: number;
  coverageRadiusKm: number;
  available: boolean;
  vehicleType: string;
  serviceTypes: RideType[];
  currentLocation: Location;
  safetyScore: number;
  kycStatus: "PENDING" | "VERIFIED";
}

export interface Vehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  color: string;
  plate: string;
  year: number;
  verified: boolean;
  createdAt: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  origin: Location;
  destination: Location;
  type: RideType;
  status: RideStatus;
  distanceKm: number;
  estimatedMinutes: number;
  suggestedPrice: number;
  finalPrice?: number;
  scheduledFor?: string;
  sharingCode: string;
  boardingPin: string;
  boardingPinVerified: boolean;
  sosTriggered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FareEstimate {
  id: string;
  passengerId: string;
  origin: Location;
  destination: Location;
  type: RideType;
  scheduledFor?: string;
  distanceKm: number;
  estimatedMinutes: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  pinRequired: boolean;
  expiresAt: string;
  bookedRideId?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  rideId: string;
  method: PaymentMethod;
  total: number;
  platformFee: number;
  driverNet: number;
  status: "PENDING" | "SETTLED";
  createdAt: string;
}

export interface PaymentWebhookEvent {
  eventId: string;
  provider: string;
  eventType: "payment.authorized" | "payment.captured" | "payment.failed" | "payment.refunded" | "payment.chargeback";
  occurredAt: string;
  paymentReference: string;
  rideId?: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SETTLED" | "FAILED" | "REFUNDED" | "CHARGEBACK";
  raw?: unknown;
  signatureVerified: boolean;
  processedAt: string;
}

export interface PaymentReconciliationEntry {
  providerReference: string;
  rideId: string;
  grossAmount: number;
  fees: number;
  netAmount: number;
  status: "PENDING" | "SETTLED" | "FAILED" | "REFUNDED" | "CHARGEBACK";
}

export interface PaymentReconciliationDiscrepancy {
  type: "MISMATCHED" | "MISSING_INTERNAL" | "MISSING_PROVIDER";
  rideId?: string;
  providerReference?: string;
  summary: string;
  internalPaymentId?: string;
}

export interface PaymentReconciliationReport {
  reportId: string;
  provider: string;
  windowStart: string;
  windowEnd: string;
  matched: number;
  mismatched: number;
  missingInternal: number;
  missingProvider: number;
  generatedAt: string;
  discrepancies: PaymentReconciliationDiscrepancy[];
}

export interface Review {
  id: string;
  rideId: string;
  reviewerId: string;
  reviewedId: string;
  score: number;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  channel?: "IN_APP" | "EMAIL" | "SMS";
  readAt?: string;
  createdAt: string;
}

export interface MfaChallenge {
  id: string;
  userId: string;
  code: string;
  deviceName: string;
  platform: string;
  method: "APP";
  expiresAt: string;
  createdAt: string;
}

export interface RideEvent {
  id: string;
  rideId: string;
  type: RideEventType;
  actorId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  rideId?: string;
  kind: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  createdAt: string;
}

export interface RiskScore {
  id: string;
  rideId: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DeviceSession {
  id: string;
  userId: string;
  refreshToken: string;
  deviceName: string;
  platform: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface RideTrackingPoint {
  id: string;
  rideId: string;
  lat: number;
  lng: number;
  speedKph?: number;
  heading?: number;
  recordedAt: string;
}

export interface SupportTicket {
  id: string;
  ownerId: string;
  rideId?: string;
  category: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  summary: string;
  createdAt: string;
}

export interface FraudSignal {
  id: string;
  rideId?: string;
  userId?: string;
  type: "INVALID_PIN" | "MFA_FAILURE" | "ANOMALOUS_SPEED" | "SOS_ESCALATION" | "PAYMENT_MISMATCH";
  severity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  metadata?: Record<string, unknown>;
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  createdAt: string;
}

export interface SafetyIncident {
  id: string;
  rideId: string;
  reporterId: string;
  type: "SOS" | "ROUTE_DEVIATION" | "ANOMALOUS_STOP" | "ANOMALOUS_SPEED";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCandidate {
  driver: DriverProfile;
  driverUser: User;
  distanceToPassengerKm: number;
  etaMinutes: number;
  totalScore: number;
  recommendedPrice: number;
}

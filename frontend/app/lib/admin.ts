import { getDashboardData } from "./dashboard";
import { backendUrl as apiUrl } from "./backend-url";

const adminEmail = process.env.MOVY_DEMO_ADMIN_EMAIL;
const adminPassword = process.env.MOVY_DEMO_ADMIN_PASSWORD;

export interface SupportTicketItem {
  id: string;
  ownerId: string;
  rideId?: string;
  category: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  summary: string;
  createdAt: string;
}

export interface SafetyIncidentItem {
  id: string;
  rideId: string;
  reporterId: string;
  type: "SOS" | "ROUTE_DEVIATION" | "ANOMALOUS_STOP" | "ANOMALOUS_SPEED";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface FraudSignalItem {
  id: string;
  rideId?: string;
  userId?: string;
  type: "INVALID_PIN" | "MFA_FAILURE" | "ANOMALOUS_SPEED" | "SOS_ESCALATION";
  severity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "PASSENGER" | "DRIVER" | "ADMIN";
  rating: number;
  walletBalance: number;
  mfaEnabled: boolean;
  createdAt: string;
  reputation: {
    userId: string;
    reviewsCount: number;
    averageScore: number;
    completedTrips: number;
    cancelledTrips: number;
    trustScore: number;
  };
}

interface LoginResponse {
  token: string;
}

interface PaginatedResponse<T> {
  items: T[];
}

interface PendingMfaResponse {
  challengeId: string;
  codePreview?: string;
}

async function getAdminToken() {
  if (!adminEmail || !adminPassword) {
    throw new Error("MOVY demo admin credentials are required");
  }

  const loginResponse = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      deviceName: "MOVY Admin Workspace",
      platform: "web"
    })
  });

  if (!loginResponse.ok) {
    throw new Error("Admin login unavailable");
  }

  if (loginResponse.status === 202) {
    const pending = (await loginResponse.json()) as PendingMfaResponse;
    if (!pending.codePreview) {
      throw new Error("Admin MFA verification unavailable");
    }

    const verifyResponse = await fetch(`${apiUrl}/api/v1/auth/mfa/verify`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        challengeId: pending.challengeId,
        code: pending.codePreview
      })
    });

    if (!verifyResponse.ok) {
      throw new Error("Admin MFA verification failed");
    }

    return ((await verifyResponse.json()) as LoginResponse).token;
  }

  return ((await loginResponse.json()) as LoginResponse).token;
}

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getAdminToken();
  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return (await response.json()) as T;
}

export async function getAdminWorkspaceData() {
  const [dashboard, supportTickets, incidents, fraudSignals, users] = await Promise.all([
    getDashboardData(),
    adminFetch<PaginatedResponse<SupportTicketItem>>("/api/v1/support/tickets?page=1&pageSize=100").catch(() => ({ items: [] })),
    adminFetch<PaginatedResponse<SafetyIncidentItem>>("/api/v1/admin/incidents?page=1&pageSize=100").catch(() => ({ items: [] })),
    adminFetch<PaginatedResponse<FraudSignalItem>>("/api/v1/admin/fraud-signals?page=1&pageSize=100").catch(() => ({ items: [] })),
    adminFetch<PaginatedResponse<AdminUserItem>>("/api/v1/admin/users?page=1&pageSize=100").catch(() => ({ items: [] }))
  ]);

  return {
    ...dashboard,
    supportTickets: supportTickets.items,
    incidents: incidents.items,
    fraudSignals: fraudSignals.items,
    users: users.items
  };
}

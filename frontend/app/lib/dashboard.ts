const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const adminEmail = process.env.MOVY_DEMO_ADMIN_EMAIL;
const adminPassword = process.env.MOVY_DEMO_ADMIN_PASSWORD;
const fallbackAllowed =
  process.env.MOVY_ALLOW_DASHBOARD_FALLBACK === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.MOVY_ALLOW_DASHBOARD_FALLBACK !== "false");

type DriverStatus = "ONLINE" | "OFFLINE";
type RideStatus = "REQUESTED" | "MATCHED" | "ACCEPTED" | "ARRIVING" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type RideType = "INSTANT" | "SCHEDULED" | "SHARED";

export interface OverviewResponse {
  kpis: {
    totalUsers: number;
    activeDrivers: number;
    activeRides: number;
    completedToday: number;
    totalRevenue: number;
  };
  security: {
    verifiedDrivers: number;
    openSosAlerts: number;
    openSafetyIncidents: number;
    openFraudSignals: number;
  };
  operations: {
    verifiedVehicles: number;
    openSupportTickets: number;
    activeSessions: number;
    mfaProtectedUsers: number;
  };
}

export interface DriverItem {
  id: string;
  businessName: string;
  basePricePerKm: number;
  coverageRadiusKm: number;
  available: boolean;
  vehicleType: string;
  serviceTypes: RideType[];
  safetyScore: number;
  kycStatus: "PENDING" | "VERIFIED";
  user?: {
    id: string;
    name: string;
    rating: number;
    walletBalance: number;
  };
}

export interface RideItem {
  id: string;
  passengerId: string;
  driverId?: string;
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  type: RideType;
  status: RideStatus;
  distanceKm: number;
  estimatedMinutes: number;
  suggestedPrice: number;
  finalPrice?: number;
  sosTriggered: boolean;
  createdAt: string;
}

export interface PaymentsSummary {
  totalRevenue: number;
  platformRevenue: number;
  driverRevenue: number;
  settledTrips: number;
}

export interface DashboardData {
  overview: OverviewResponse;
  drivers: DriverItem[];
  rides: RideItem[];
  payments: PaymentsSummary;
  live: boolean;
  generatedAt: string;
}

interface LoginResponse {
  token: string;
}

interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface PendingMfaResponse {
  mfaRequired: true;
  challengeId: string;
  codePreview?: string;
}

function getDashboardCredentials() {
  if (adminEmail && adminPassword) {
    return {
      email: adminEmail,
      password: adminPassword
    };
  }

  if (fallbackAllowed) {
    return null;
  }

  throw new Error("MOVY demo admin credentials are required when dashboard fallback is disabled");
}

async function apiFetch<T>(path: string, token: string): Promise<T> {
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

function createFallbackData(): DashboardData {
  const generatedAt = new Date().toISOString();

  return {
    overview: {
      kpis: {
        totalUsers: 428,
        activeDrivers: 37,
        activeRides: 12,
        completedToday: 84,
        totalRevenue: 12840.35
      },
      security: {
        verifiedDrivers: 34,
        openSosAlerts: 1,
        openSafetyIncidents: 2,
        openFraudSignals: 3
      },
      operations: {
        verifiedVehicles: 28,
        openSupportTickets: 6,
        activeSessions: 93,
        mfaProtectedUsers: 41
      }
    },
    drivers: [
      {
        id: "drv-1",
        businessName: "Ana Mobilidade Premium",
        basePricePerKm: 3.8,
        coverageRadiusKm: 18,
        available: true,
        vehicleType: "Sedan",
        serviceTypes: ["INSTANT", "SCHEDULED"],
        safetyScore: 96,
        kycStatus: "VERIFIED",
        user: {
          id: "usr-1",
          name: "Ana Souza",
          rating: 4.95,
          walletBalance: 642.18
        }
      },
      {
        id: "drv-2",
        businessName: "Carlos Executivo",
        basePricePerKm: 4.25,
        coverageRadiusKm: 24,
        available: true,
        vehicleType: "SUV",
        serviceTypes: ["INSTANT", "SCHEDULED", "SHARED"],
        safetyScore: 92,
        kycStatus: "VERIFIED",
        user: {
          id: "usr-2",
          name: "Carlos Lima",
          rating: 4.88,
          walletBalance: 904.4
        }
      },
      {
        id: "drv-3",
        businessName: "Zona Norte Flash",
        basePricePerKm: 3.4,
        coverageRadiusKm: 12,
        available: false,
        vehicleType: "Hatch",
        serviceTypes: ["INSTANT"],
        safetyScore: 89,
        kycStatus: "PENDING",
        user: {
          id: "usr-3",
          name: "Bruno Costa",
          rating: 4.61,
          walletBalance: 182.77
        }
      }
    ],
    rides: [
      {
        id: "ride-1",
        passengerId: "pass-1",
        driverId: "drv-1",
        origin: { address: "Av. Paulista, Bela Vista" },
        destination: { address: "Pinheiros, Sao Paulo" },
        type: "INSTANT",
        status: "IN_PROGRESS",
        distanceKm: 8.6,
        estimatedMinutes: 21,
        suggestedPrice: 32.4,
        finalPrice: undefined,
        sosTriggered: false,
        createdAt: generatedAt
      },
      {
        id: "ride-2",
        passengerId: "pass-2",
        driverId: "drv-2",
        origin: { address: "Congonhas" },
        destination: { address: "Alphaville" },
        type: "SCHEDULED",
        status: "MATCHED",
        distanceKm: 31.8,
        estimatedMinutes: 48,
        suggestedPrice: 108.9,
        finalPrice: undefined,
        sosTriggered: false,
        createdAt: generatedAt
      },
      {
        id: "ride-3",
        passengerId: "pass-3",
        driverId: undefined,
        origin: { address: "Guarulhos Centro" },
        destination: { address: "Tiete" },
        type: "SHARED",
        status: "REQUESTED",
        distanceKm: 22.5,
        estimatedMinutes: 41,
        suggestedPrice: 56.7,
        finalPrice: undefined,
        sosTriggered: true,
        createdAt: generatedAt
      },
      {
        id: "ride-4",
        passengerId: "pass-4",
        driverId: "drv-1",
        origin: { address: "Moema" },
        destination: { address: "Vila Olimpia" },
        type: "INSTANT",
        status: "COMPLETED",
        distanceKm: 6.2,
        estimatedMinutes: 18,
        suggestedPrice: 24.3,
        finalPrice: 25.1,
        sosTriggered: false,
        createdAt: generatedAt
      }
    ],
    payments: {
      totalRevenue: 12840.35,
      platformRevenue: 2488.71,
      driverRevenue: 10351.64,
      settledTrips: 84
    },
    live: false,
    generatedAt
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const credentials = getDashboardCredentials();

  if (!credentials) {
    return createFallbackData();
  }

  try {
    const loginResponse = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        deviceName: "MOVY Dashboard",
        platform: "web"
      })
    });

    if (!loginResponse.ok) {
      throw new Error("Admin login unavailable");
    }

    let token: string | undefined;
    if (loginResponse.status === 202) {
      const pending = (await loginResponse.json()) as PendingMfaResponse;
      if (!pending.codePreview) {
        throw new Error("Admin MFA verification unavailable for dashboard");
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

      token = ((await verifyResponse.json()) as LoginResponse).token;
    } else {
      token = ((await loginResponse.json()) as LoginResponse).token;
    }

    const [overview, drivers, rides, payments] = await Promise.all([
      apiFetch<OverviewResponse>("/api/v1/overview", token),
      apiFetch<PaginatedResponse<DriverItem>>("/api/v1/drivers?page=1&pageSize=50", token),
      apiFetch<PaginatedResponse<RideItem>>("/api/v1/rides?page=1&pageSize=100", token),
      apiFetch<PaymentsSummary>("/api/v1/payments/summary", token)
    ]);

    return {
      overview,
      drivers: drivers.items,
      rides: rides.items,
      payments,
      live: true,
      generatedAt: new Date().toISOString()
    };
  } catch {
    if (!fallbackAllowed) {
      throw new Error("MOVY dashboard could not load live operational data and fallback is disabled");
    }

    return createFallbackData();
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatRelativeStatus(status: DriverStatus | RideStatus | "LOW" | "MEDIUM" | "HIGH") {
  const labels: Record<string, string> = {
    ONLINE: "Online",
    OFFLINE: "Offline",
    REQUESTED: "Solicitada",
    MATCHED: "Em matching",
    ACCEPTED: "Aceita",
    ARRIVING: "Chegando",
    CHECKED_IN: "Check-in",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluida",
    CANCELLED: "Cancelada",
    LOW: "Baixo",
    MEDIUM: "Medio",
    HIGH: "Alto"
  };

  return labels[status] ?? status;
}

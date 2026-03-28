import { backendUrl } from "../../lib/backend-url";

const driverEmail = process.env.MOVY_DEMO_DRIVER_EMAIL ?? "carlos@movy.local";
const driverPassword = process.env.MOVY_DEMO_DRIVER_PASSWORD ?? "123456";
const adminEmail = process.env.MOVY_DEMO_ADMIN_EMAIL ?? "admin@movy.local";
const adminPassword = process.env.MOVY_DEMO_ADMIN_PASSWORD ?? "admin123";
const passengerEmail = process.env.MOVY_DEMO_PASSENGER_EMAIL ?? "ana@movy.local";
const passengerPassword = process.env.MOVY_DEMO_PASSENGER_PASSWORD ?? "123456";

async function loginAs(email: string, password: string, deviceName: string) {
  const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      email,
      password,
      deviceName,
      platform: "web"
    })
  });

  if (!response.ok) {
    throw new Error(`Login unavailable for ${email}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

export async function getDriverToken() {
  return loginAs(driverEmail, driverPassword, "Frontend driver cockpit");
}

export async function getAdminToken() {
  return loginAs(adminEmail, adminPassword, "Frontend admin orchestration");
}

export async function getPassengerToken() {
  return loginAs(passengerEmail, passengerPassword, "Frontend passenger orchestration");
}

export async function backendFetchWithToken<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(errorBody?.message ?? `Backend request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

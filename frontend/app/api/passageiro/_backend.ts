import { backendUrl } from "../../lib/backend-url";

const passengerEmail = process.env.MOVY_DEMO_PASSENGER_EMAIL ?? "ana@movy.local";
const passengerPassword = process.env.MOVY_DEMO_PASSENGER_PASSWORD ?? "123456";

export async function getPassengerAccessToken() {
  const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      email: passengerEmail,
      password: passengerPassword,
      deviceName: "Frontend passenger experience",
      platform: "web"
    })
  });

  if (!response.ok) {
    throw new Error("Passenger login unavailable");
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

export async function backendPassengerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getPassengerAccessToken();
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

  return (await response.json()) as T;
}

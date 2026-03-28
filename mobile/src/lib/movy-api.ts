import type { MobileDriverSnapshot, MobileEstimate, MobileRide } from "../types";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3333";
const passengerEmail = process.env.EXPO_PUBLIC_PASSENGER_EMAIL ?? "ana@movy.local";
const passengerPassword = process.env.EXPO_PUBLIC_PASSENGER_PASSWORD ?? "123456";

async function loginPassenger() {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: passengerEmail,
      password: passengerPassword,
      deviceName: "MOVY mobile passenger",
      platform: "mobile"
    })
  });

  if (!response.ok) {
    throw new Error("Falha ao autenticar passageiro.");
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

async function passengerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await loginPassenger();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(errorBody?.message ?? "Falha na operacao mobile.");
  }

  return (await response.json()) as T;
}

export async function createMobileEstimate() {
  const response = await passengerFetch<{ estimate: MobileEstimate }>("/api/v1/rides/estimates", {
    method: "POST",
    body: JSON.stringify({
      origin: {
        address: "Av. Paulista, Bela Vista",
        lat: -23.563099,
        lng: -46.654419
      },
      destination: {
        address: "Pinheiros, Sao Paulo",
        lat: -23.56674,
        lng: -46.69297
      },
      type: "INSTANT"
    })
  });

  return response.estimate;
}

export async function bookMobileRide(estimateId: string) {
  return passengerFetch<{ ride: MobileRide }>("/api/v1/rides", {
    method: "POST",
    body: JSON.stringify({
      estimateId
    })
  });
}

export async function loadDriverSnapshot() {
  const response = await fetch(`${baseUrl}/api/motorista/operacao`, {
    method: "GET"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(errorBody?.message ?? "Falha ao carregar cockpit do motorista.");
  }

  return (await response.json()) as MobileDriverSnapshot;
}

export async function runDriverAction(action: "prepare" | "accept" | "start" | "complete", rideId?: string) {
  const response = await fetch(`${baseUrl}/api/motorista/operacao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      rideId
    })
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(errorBody?.message ?? "Falha na acao do motorista.");
  }

  return (await response.json()) as MobileDriverSnapshot;
}

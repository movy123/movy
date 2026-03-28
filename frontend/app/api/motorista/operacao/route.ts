import { NextResponse } from "next/server";
import type { DriverOperationSnapshot } from "../../../lib/driver";
import type { FareEstimateResponse } from "../../../lib/passenger";
import {
  backendFetchWithToken,
  getAdminToken,
  getDriverToken,
  getPassengerToken
} from "../_backend";

interface DriverInfo {
  id: string;
  userId: string;
  businessName: string;
  available: boolean;
  vehicleType: string;
  safetyScore: number;
  user?: {
    name: string;
    rating: number;
  };
}

interface RideInfo {
  id: string;
  status: string;
  suggestedPrice: number;
  finalPrice?: number;
  origin: { address: string };
  destination: { address: string };
  boardingPin: string;
  passengerId: string;
  driverId?: string;
}

interface PaginatedResponse<T> {
  items: T[];
}

async function buildDriverSnapshot(): Promise<DriverOperationSnapshot> {
  const driverToken = await getDriverToken();
  const [drivers, rides, wallet] = await Promise.all([
    backendFetchWithToken<PaginatedResponse<DriverInfo>>(driverToken, "/api/v1/drivers?page=1&pageSize=50"),
    backendFetchWithToken<PaginatedResponse<RideInfo>>(driverToken, "/api/v1/rides?page=1&pageSize=100"),
    backendFetchWithToken<{ balance: number; items: Array<unknown> }>(driverToken, "/api/v1/wallet/me?page=1&pageSize=20")
  ]);

  const driver = drivers.items.find((item) => item.user?.name?.includes("Carlos")) ?? drivers.items[0];
  if (!driver) {
    throw new Error("Driver profile unavailable");
  }

  const ride =
    rides.items.find((item) => item.driverId === driver.id && item.status !== "COMPLETED" && item.status !== "CANCELLED") ??
    rides.items.find((item) => item.driverId === driver.id) ??
    rides.items.find((item) => item.status === "MATCHED" && item.driverId === driver.id);
  const notifications = await backendFetchWithToken<PaginatedResponse<{ id: string; title: string; message: string; level: string }>>(
    driverToken,
    `/api/v1/notifications/${driver.userId}?page=1&pageSize=20`
  ).catch(() => ({ items: [] }));

  return {
    driver: {
      id: driver.id,
      businessName: driver.businessName,
      available: driver.available,
      vehicleType: driver.vehicleType,
      safetyScore: driver.safetyScore,
      userName: driver.user?.name ?? "Motorista MOVY",
      rating: driver.user?.rating ?? 0
    },
    ride,
    wallet: {
      balance: wallet.balance,
      transactions: wallet.items.length
    },
    notifications: notifications.items
  };
}

async function ensureDriverOpportunity() {
  const passengerToken = await getPassengerToken();
  const adminToken = await getAdminToken();
  const driverToken = await getDriverToken();

  const drivers = await backendFetchWithToken<PaginatedResponse<DriverInfo>>(driverToken, "/api/v1/drivers?page=1&pageSize=50");
  const driver = drivers.items.find((item) => item.user?.name?.includes("Carlos")) ?? drivers.items[0];
  if (!driver) {
    throw new Error("Driver profile unavailable");
  }

  const rides = await backendFetchWithToken<PaginatedResponse<RideInfo>>(driverToken, "/api/v1/rides?page=1&pageSize=100");
  const existing = rides.items.find(
    (item) => item.driverId === driver.id && item.status !== "COMPLETED" && item.status !== "CANCELLED"
  );
  if (existing) {
    return existing;
  }

  const estimate = await backendFetchWithToken<{ estimate: FareEstimateResponse }>(passengerToken, "/api/v1/rides/estimates", {
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

  const booked = await backendFetchWithToken<{ ride: RideInfo }>(passengerToken, "/api/v1/rides", {
    method: "POST",
    body: JSON.stringify({
      estimateId: estimate.estimate.id
    })
  });

  await backendFetchWithToken<{ ride: RideInfo }>(adminToken, `/api/v1/rides/${booked.ride.id}/match`, {
    method: "POST",
    body: JSON.stringify({
      driverId: driver.id
    })
  });

  const refreshedRides = await backendFetchWithToken<PaginatedResponse<RideInfo>>(driverToken, "/api/v1/rides?page=1&pageSize=100");
  const matchedRide = refreshedRides.items.find((item) => item.id === booked.ride.id);
  if (!matchedRide) {
    throw new Error("Matched ride unavailable");
  }

  return matchedRide;
}

export async function GET() {
  try {
    const snapshot = await buildDriverSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load driver operation" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const driverToken = await getDriverToken();
    const body = (await request.json()) as { action: "prepare" | "accept" | "start" | "complete"; rideId?: string };

    if (body.action === "prepare") {
      await ensureDriverOpportunity();
      return NextResponse.json(await buildDriverSnapshot());
    }

    if (!body.rideId) {
      return NextResponse.json({ message: "Ride is required" }, { status: 400 });
    }

    if (body.action === "accept") {
      await backendFetchWithToken(driverToken, `/api/v1/rides/${body.rideId}/accept`, {
        method: "POST",
        body: JSON.stringify({})
      });
    }

    if (body.action === "start") {
      const rides = await backendFetchWithToken<PaginatedResponse<RideInfo>>(driverToken, "/api/v1/rides?page=1&pageSize=100");
      const ride = rides.items.find((item) => item.id === body.rideId);
      if (!ride) {
        throw new Error("Ride not found");
      }

      if (ride.status === "ACCEPTED") {
        const passengerToken = await getPassengerToken();
        await backendFetchWithToken(passengerToken, `/api/v1/rides/${body.rideId}/checkin-pin`, {
          method: "POST",
          body: JSON.stringify({
            pin: ride.boardingPin
          })
        });
      }

      await backendFetchWithToken(driverToken, `/api/v1/rides/${body.rideId}/start`, {
        method: "POST",
        body: JSON.stringify({})
      });
    }

    if (body.action === "complete") {
      await backendFetchWithToken(driverToken, `/api/v1/rides/${body.rideId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          method: "PIX"
        })
      });
    }

    return NextResponse.json(await buildDriverSnapshot());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to execute driver action" },
      { status: 400 }
    );
  }
}

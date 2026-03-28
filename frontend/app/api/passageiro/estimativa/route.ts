import { NextResponse } from "next/server";
import type { BookedRideResponse, FareEstimateResponse } from "../../../lib/passenger";
import { backendPassengerFetch } from "../_backend";

interface EstimatePayload {
  origin: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  type: "INSTANT" | "SCHEDULED" | "SHARED";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EstimatePayload;
    const result = await backendPassengerFetch<{ estimate: FareEstimateResponse }>("/api/v1/rides/estimates", {
      method: "POST",
      body: JSON.stringify(body)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to create estimate"
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { estimateId: string };
    const result = await backendPassengerFetch<BookedRideResponse>("/api/v1/rides", {
      method: "POST",
      body: JSON.stringify(body)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to book ride from estimate"
      },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "movy-frontend",
    timestamp: new Date().toISOString()
  });
}

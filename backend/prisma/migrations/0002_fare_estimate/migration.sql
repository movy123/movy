CREATE TABLE "FareEstimate" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "originLat" DECIMAL(10,7) NOT NULL,
    "originLng" DECIMAL(10,7) NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLat" DECIMAL(10,7) NOT NULL,
    "destinationLng" DECIMAL(10,7) NOT NULL,
    "type" "RideType" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "suggestedPrice" DECIMAL(10,2) NOT NULL,
    "minPrice" DECIMAL(10,2) NOT NULL,
    "maxPrice" DECIMAL(10,2) NOT NULL,
    "riskScore" DECIMAL(5,2) NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "pinRequired" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "bookedRideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FareEstimate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FareEstimate_bookedRideId_key" ON "FareEstimate"("bookedRideId");
CREATE INDEX "FareEstimate_passengerId_createdAt_idx" ON "FareEstimate"("passengerId", "createdAt");
CREATE INDEX "FareEstimate_expiresAt_idx" ON "FareEstimate"("expiresAt");

ALTER TABLE "FareEstimate"
ADD CONSTRAINT "FareEstimate_passengerId_fkey"
FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FareEstimate"
ADD CONSTRAINT "FareEstimate_bookedRideId_fkey"
FOREIGN KEY ("bookedRideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

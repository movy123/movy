export interface PassengerLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface FareEstimateResponse {
  id: string;
  passengerId: string;
  origin: PassengerLocation;
  destination: PassengerLocation;
  type: "INSTANT" | "SCHEDULED" | "SHARED";
  distanceKm: number;
  estimatedMinutes: number;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  pinRequired: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface BookedRideResponse {
  ride: {
    id: string;
    status: string;
    suggestedPrice: number;
    boardingPin: string;
  };
  fareEstimate: FareEstimateResponse;
  candidates: Array<{
    driver: {
      id: string;
      businessName: string;
      vehicleType: string;
      safetyScore: number;
    };
    driverUser: {
      name: string;
      rating: number;
    };
    etaMinutes: number;
    recommendedPrice: number;
  }>;
  risk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    score: number;
  };
}

export function getRiskTone(riskLevel: FareEstimateResponse["riskLevel"]) {
  if (riskLevel === "HIGH") {
    return "high";
  }
  if (riskLevel === "MEDIUM") {
    return "medium";
  }
  return "low";
}

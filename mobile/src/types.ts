export interface MobileEstimate {
  id: string;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  estimatedMinutes: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  pinRequired: boolean;
}

export interface MobileRide {
  id: string;
  status: string;
  suggestedPrice: number;
  finalPrice?: number;
  boardingPin: string;
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  driverId?: string;
}

export interface MobileDriverSnapshot {
  driver: {
    id: string;
    businessName: string;
    available: boolean;
    userName: string;
    safetyScore: number;
  };
  ride?: MobileRide;
  wallet: {
    balance: number;
    transactions: number;
  };
}

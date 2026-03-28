export interface DriverOperationRide {
  id: string;
  status: string;
  suggestedPrice: number;
  finalPrice?: number;
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  boardingPin: string;
  passengerId: string;
  driverId?: string;
}

export interface DriverOperationSnapshot {
  driver: {
    id: string;
    businessName: string;
    available: boolean;
    vehicleType: string;
    safetyScore: number;
    userName: string;
    rating: number;
  };
  ride?: DriverOperationRide;
  wallet: {
    balance: number;
    transactions: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    level: string;
  }>;
}

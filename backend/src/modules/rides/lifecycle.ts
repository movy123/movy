import type { RideStatus } from "../../shared/types.js";

const allowedTransitions: Record<RideStatus, RideStatus[]> = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ARRIVING", "CHECKED_IN", "CANCELLED"],
  ARRIVING: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

export function canTransitionRide(currentStatus: RideStatus, nextStatus: RideStatus) {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function getRideTransitionError(currentStatus: RideStatus, nextStatus: RideStatus) {
  const allowed = allowedTransitions[currentStatus];

  if (allowed.includes(nextStatus)) {
    return undefined;
  }

  return {
    code: "INVALID_RIDE_TRANSITION" as const,
    message: `Cannot transition ride from ${currentStatus} to ${nextStatus}`,
    currentStatus,
    nextStatus,
    allowedNextStatuses: allowed
  };
}

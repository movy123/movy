import {
  addAuditLog,
  addTrackingPoint,
  createFraudSignal,
  createSafetyIncident,
  consumeFareEstimate,
  createFareEstimate,
  createRide,
  creditDriverWallet,
  getFareEstimateById,
  getCandidateMatches,
  getDriverById,
  getRiskScore,
  getRideById,
  getUserById,
  pushNotification,
  recordRideEvent,
  saveRiskScore,
  settlePayment,
  listTrackingPoints,
  updateRide
} from "../../shared/persistence.js";
import { haversineKm } from "../../shared/store.js";
import type { FareEstimate, Location, PaymentMethod, Ride, RideType } from "../../shared/types.js";
import { getRideTransitionError } from "./lifecycle.js";

export function estimateRide(
  origin: Location,
  destination: Location,
  type: RideType
): Omit<FareEstimate, "id" | "passengerId" | "origin" | "destination" | "type" | "scheduledFor" | "expiresAt" | "bookedRideId" | "createdAt"> {
  const distanceKm = Number(haversineKm(origin, destination).toFixed(2));
  const estimatedMinutes = Math.max(8, Math.round(distanceKm * 2.7));
  const baseMultiplier = type === "SCHEDULED" ? 1.12 : type === "SHARED" ? 0.88 : 1;
  const suggestedPrice = Number((distanceKm * 3.8 * baseMultiplier + 6).toFixed(2));
  const riskScore = distanceKm > 20 ? 0.22 : distanceKm > 10 ? 0.13 : 0.07;
  const minPrice = Number((suggestedPrice * 0.92).toFixed(2));
  const maxPrice = Number((suggestedPrice * 1.08).toFixed(2));
  const riskLevel: FareEstimate["riskLevel"] = riskScore >= 0.7 ? "HIGH" : riskScore >= 0.35 ? "MEDIUM" : "LOW";
  const pinRequired = riskScore >= 0.13;

  return {
    distanceKm,
    estimatedMinutes,
    suggestedPrice,
    minPrice,
    maxPrice,
    riskScore,
    riskLevel,
    pinRequired
  };
}

export async function createFareEstimateForPassenger(input: {
  passengerId: string;
  origin: Location;
  destination: Location;
  type: RideType;
  scheduledFor?: string;
}) {
  const estimate = estimateRide(input.origin, input.destination, input.type);
  const fareEstimate = await createFareEstimate({
    passengerId: input.passengerId,
    origin: input.origin,
    destination: input.destination,
    type: input.type,
    scheduledFor: input.scheduledFor,
    distanceKm: estimate.distanceKm,
    estimatedMinutes: estimate.estimatedMinutes,
    suggestedPrice: estimate.suggestedPrice,
    minPrice: estimate.minPrice,
    maxPrice: estimate.maxPrice,
    riskScore: estimate.riskScore,
    riskLevel: estimate.riskLevel,
    pinRequired: estimate.pinRequired,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });

  await addAuditLog({
    actorId: input.passengerId,
    entityType: "FareEstimate",
    entityId: fareEstimate.id,
    action: "FARE_ESTIMATE_CREATED",
    metadata: {
      type: input.type,
      riskLevel: fareEstimate.riskLevel
    }
  });

  return fareEstimate;
}

export async function createRideRequest(input: {
  passengerId: string;
  origin: Location;
  destination: Location;
  type: RideType;
  scheduledFor?: string;
}) {
  const estimate = estimateRide(input.origin, input.destination, input.type);
  const ride = await createRide({
    ...input,
    distanceKm: estimate.distanceKm,
    estimatedMinutes: estimate.estimatedMinutes,
    suggestedPrice: estimate.suggestedPrice
  });
  const candidates = await getCandidateMatches(ride);
  const risk = await saveRiskScore(ride.id, estimate.riskScore, buildRiskReasons(input.type, estimate.distanceKm));
  await addAuditLog({
    actorId: input.passengerId,
    entityType: "Ride",
    entityId: ride.id,
    action: "RIDE_REQUESTED",
    metadata: {
      type: input.type,
      riskLevel: risk.level
    }
  });

  return {
    ride,
    estimate,
    candidates,
    risk
  };
}

export async function createRideFromEstimate(input: { estimateId: string; passengerId: string }) {
  const fareEstimate = await getFareEstimateById(input.estimateId);
  if (!fareEstimate) {
    return { error: "Fare estimate not found" as const };
  }

  if (fareEstimate.passengerId !== input.passengerId) {
    return { error: "Fare estimate does not belong to passenger" as const };
  }

  if (fareEstimate.bookedRideId) {
    return { error: "Fare estimate already used" as const };
  }

  if (new Date(fareEstimate.expiresAt).getTime() < Date.now()) {
    return { error: "Fare estimate expired" as const };
  }

  const ride = await createRide({
    passengerId: fareEstimate.passengerId,
    origin: fareEstimate.origin,
    destination: fareEstimate.destination,
    type: fareEstimate.type,
    scheduledFor: fareEstimate.scheduledFor,
    distanceKm: fareEstimate.distanceKm,
    estimatedMinutes: fareEstimate.estimatedMinutes,
    suggestedPrice: fareEstimate.suggestedPrice
  });
  await consumeFareEstimate(fareEstimate.id, ride.id);

  const candidates = await getCandidateMatches(ride);
  const risk = await saveRiskScore(ride.id, fareEstimate.riskScore, buildRiskReasons(fareEstimate.type, fareEstimate.distanceKm));
  await addAuditLog({
    actorId: fareEstimate.passengerId,
    entityType: "Ride",
    entityId: ride.id,
    action: "RIDE_REQUESTED_FROM_ESTIMATE",
    metadata: {
      estimateId: fareEstimate.id,
      riskLevel: risk.level
    }
  });

  return {
    ride,
    fareEstimate,
    candidates,
    risk
  };
}

export async function matchRide(rideId: string, driverId?: string) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return undefined;
  }

  const transitionError = getRideTransitionError(ride.status, "MATCHED");
  if (transitionError) {
    return {
      error: transitionError
    };
  }

  const candidates = await getCandidateMatches(ride);
  const selected = driverId
    ? candidates.find((candidate) => candidate.driver.id === driverId)
    : candidates[0];

  if (!selected) {
    return {
      ride,
      selected: undefined
    };
  }

  const updated = await updateRide(ride.id, {
    driverId: selected.driver.id,
    status: "MATCHED",
    suggestedPrice: selected.recommendedPrice
  });

  if (!updated) {
    return undefined;
  }

  await recordRideEvent(ride.id, "MATCHED", selected.driver.userId, {
    driverId: selected.driver.id,
    recommendedPrice: selected.recommendedPrice
  });
  await addAuditLog({
    actorId: selected.driver.userId,
    entityType: "Ride",
    entityId: ride.id,
    action: "RIDE_MATCHED",
    metadata: {
      driverId: selected.driver.id
    }
  });

  await pushNotification(
    ride.passengerId,
    "Motorista encontrado",
    `${selected.driverUser.name} esta disponivel para sua corrida.`,
    "INFO"
  );
  await pushNotification(
    selected.driver.userId,
    "Nova oportunidade",
    `Nova corrida ${updated.id} pronta para aceite.`,
    "INFO"
  );

  return {
    ride: updated,
    selected
  };
}

export async function acceptRide(rideId: string, driverId: string) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return undefined;
  }

  const transitionError = getRideTransitionError(ride.status, "ACCEPTED");
  if (transitionError) {
    return {
      error: transitionError
    };
  }

  const updated = await updateRide(rideId, {
    driverId,
    status: "ACCEPTED"
  });
  if (updated) {
    const driver = await getDriverById(driverId);
    await recordRideEvent(rideId, "ACCEPTED", driver?.userId, { driverId });
  }
  return updated;
}

export async function startRide(rideId: string) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return undefined;
  }

  const transitionError = getRideTransitionError(ride.status, "IN_PROGRESS");
  if (transitionError) {
    return {
      error: transitionError
    };
  }

  const updated = await updateRide(rideId, {
    status: "IN_PROGRESS"
  });
  if (updated) {
    await recordRideEvent(rideId, "STARTED", updated.driverId, {});
  }
  return updated;
}

export async function verifyBoardingPin(rideId: string, pin: string, actorId: string) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return { error: "Ride not found" as const };
  }

  const transitionError = getRideTransitionError(ride.status, "CHECKED_IN");
  if (transitionError) {
    return { error: transitionError };
  }

  if (ride.boardingPin !== pin) {
    await addAuditLog({
      actorId,
      entityType: "Ride",
      entityId: rideId,
      action: "RIDE_PIN_INVALID",
      metadata: {}
    });
    await createFraudSignal({
      rideId,
      userId: actorId,
      type: "INVALID_PIN",
      severity: "MEDIUM",
      summary: "Tentativa de embarque com PIN invalido.",
      metadata: {
        actorId
      },
      status: "OPEN"
    });
    return { error: "Invalid PIN" as const };
  }

  const updated = await updateRide(rideId, {
    status: "CHECKED_IN",
    boardingPinVerified: true
  });

  if (!updated) {
    return { error: "Ride not found" as const };
  }

  await recordRideEvent(rideId, "PIN_VERIFIED", actorId, {});
  await addAuditLog({
    actorId,
    entityType: "Ride",
    entityId: rideId,
    action: "RIDE_PIN_VERIFIED",
    metadata: {}
  });

  return {
    ride: updated
  };
}

export async function triggerSos(rideId: string) {
  const currentRide = await getRideById(rideId);
  if (!currentRide) {
    return undefined;
  }

  if (["COMPLETED", "CANCELLED"].includes(currentRide.status)) {
    return {
      error: {
        code: "INVALID_RIDE_TRANSITION" as const,
        message: `Cannot trigger SOS for ride in status ${currentRide.status}`,
        currentStatus: currentRide.status,
        allowedNextStatuses: []
      }
    };
  }

  const ride = await updateRide(rideId, {
    sosTriggered: true
  });
  if (ride) {
    await recordRideEvent(rideId, "SOS_TRIGGERED", ride.passengerId, {});
    await pushNotification(ride.passengerId, "SOS acionado", "Central de seguranca notificada.", "CRITICAL");
    await createSafetyIncident({
      rideId,
      reporterId: ride.passengerId,
      type: "SOS",
      status: "OPEN",
      summary: "Alerta SOS acionado durante a corrida.",
      metadata: {
        passengerId: ride.passengerId,
        driverId: ride.driverId
      }
    });
    await createFraudSignal({
      rideId,
      userId: ride.passengerId,
      type: "SOS_ESCALATION",
      severity: "HIGH",
      summary: "Corrida encaminhada para protocolo de seguranca apos SOS.",
      metadata: {
        driverId: ride.driverId
      },
      status: "OPEN"
    });
    if (ride.driverId) {
      const driver = await getDriverById(ride.driverId);
      if (driver) {
        await pushNotification(driver.userId, "SOS na viagem", "Protocolo de seguranca iniciado.", "CRITICAL");
      }
    }
  }
  return ride;
}

export async function completeRide(rideId: string, method: PaymentMethod) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return undefined;
  }

  const transitionError = getRideTransitionError(ride.status, "COMPLETED");
  if (transitionError) {
    return {
      error: transitionError
    };
  }

  const finalPrice = Number((ride.suggestedPrice * 1.04).toFixed(2));
  const completed = (await updateRide(rideId, {
    status: "COMPLETED",
    finalPrice
  })) as Ride | undefined;

  if (!completed) {
    return undefined;
  }

  const payment = await settlePayment(rideId, method, finalPrice);

  if (completed.driverId) {
    await creditDriverWallet(completed.driverId, payment.driverNet);
  }
  await recordRideEvent(rideId, "COMPLETED", completed.driverId, {
    finalPrice,
    paymentMethod: method
  });
  await addAuditLog({
    actorId: completed.driverId,
    entityType: "Ride",
    entityId: rideId,
    action: "RIDE_COMPLETED",
    metadata: {
      finalPrice
    }
  });

  const passenger = await getUserById(completed.passengerId);
  if (passenger) {
    await pushNotification(passenger.id, "Pagamento concluido", `Sua corrida foi encerrada por R$ ${finalPrice}.`, "INFO");
  }

  return {
    ride: completed,
    payment,
    risk: await getRiskScore(rideId)
  };
}

export async function appendTrackingPoint(
  rideId: string,
  actorId: string,
  point: {
    lat: number;
    lng: number;
    speedKph?: number;
    heading?: number;
  }
) {
  const ride = await getRideById(rideId);
  if (!ride) {
    return undefined;
  }

  const created = await addTrackingPoint(rideId, point);
  await recordRideEvent(rideId, "TRACKING_UPDATED", actorId, {
    lat: point.lat,
    lng: point.lng
  });

  if ((point.speedKph ?? 0) >= 120) {
    await createSafetyIncident({
      rideId,
      reporterId: actorId,
      type: "ANOMALOUS_SPEED",
      status: "OPEN",
      summary: "Velocidade anomala detectada durante a viagem.",
      metadata: {
        speedKph: point.speedKph
      }
    });
    await createFraudSignal({
      rideId,
      userId: actorId,
      type: "ANOMALOUS_SPEED",
      severity: "HIGH",
      summary: "Evento de velocidade alta sinalizado para analise operacional.",
      metadata: {
        speedKph: point.speedKph
      },
      status: "OPEN"
    });
  }

  return {
    point: created,
    totalPoints: (await listTrackingPoints(rideId)).length
  };
}

function buildRiskReasons(type: RideType, distanceKm: number) {
  const reasons = ["new_request"];
  if (type === "SCHEDULED") {
    reasons.push("scheduled_coordination");
  }
  if (type === "SHARED") {
    reasons.push("multi_party_trip");
  }
  if (distanceKm > 10) {
    reasons.push("long_distance");
  }
  return reasons;
}

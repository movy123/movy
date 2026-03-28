# MOVY API Contracts

## Scope

This document describes the critical API contracts already implemented in MOVY and currently used by backend, web and mobile integrations.

Base path:

- Primary: `/api/v1`
- Compatibility: `/api`

Content type:

- Requests: `application/json`
- Responses: `application/json`, except `204 No Content`

Cross-cutting headers:

- `Authorization: Bearer <token>` for protected routes
- `x-request-id: <uuid>` optional request correlation header
- `Idempotency-Key: <string>` optional but recommended for critical write routes

Current idempotent write routes:

- `POST /api/v1/rides`
- `POST /api/v1/rides/:rideId/complete`
- `POST /api/v1/support/tickets`

Idempotency behavior:

- Same key + same payload: replays original response and sets `idempotent-replayed: true`
- Same key + different payload: returns `409` with `IDEMPOTENCY_KEY_CONFLICT`

## Pagination

List endpoints now use a formal envelope.

Query parameters:

- `page`: 1-based integer, default `1`
- `pageSize`: integer from `1` to `100`, default `20`

Paginated response shape:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 48,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Current paginated list endpoints:

- `GET /api/v1/auth/sessions`
- `GET /api/v1/drivers`
- `GET /api/v1/drivers/:driverId/vehicles`
- `GET /api/v1/rides`
- `GET /api/v1/payments`
- `GET /api/v1/wallet/me` for the `items` transaction list
- `GET /api/v1/notifications/me`
- `GET /api/v1/notifications/:userId`
- `GET /api/v1/support/tickets`
- `GET /api/v1/support/my-tickets`
- `GET /api/v1/admin/fraud-signals`
- `GET /api/v1/admin/incidents`
- `GET /api/v1/admin/users`

## Error contract

Common error shape:

```json
{
  "message": "Human-readable message",
  "requestId": "optional-request-id"
}
```

Some domain conflicts return richer payloads, for example invalid ride transitions:

```json
{
  "code": "INVALID_RIDE_TRANSITION",
  "message": "Cannot transition ride from MATCHED to COMPLETED",
  "currentStatus": "MATCHED",
  "nextStatus": "COMPLETED",
  "allowedNextStatuses": ["ACCEPTED", "CANCELLED"]
}
```

## Authentication

### `POST /api/v1/auth/register`

Creates a user. Drivers also receive an initial driver profile.

Request:

```json
{
  "name": "Ana Passageira",
  "email": "ana@movy.local",
  "password": "123456",
  "role": "PASSENGER"
}
```

Success:

- `201` authenticated session created
- `202` MFA challenge required for users with MFA enabled

`201` response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Ana Passageira",
    "email": "ana@movy.local",
    "role": "PASSENGER"
  },
  "token": "jwt",
  "refreshToken": "opaque-token"
}
```

### `POST /api/v1/auth/login`

Request:

```json
{
  "email": "ana@movy.local",
  "password": "123456",
  "deviceName": "MOVY web",
  "platform": "web"
}
```

Success:

- `200` authenticated session created
- `202` MFA challenge required

`200` response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Ana Passageira",
    "email": "ana@movy.local",
    "role": "PASSENGER"
  },
  "token": "jwt",
  "refreshToken": "opaque-token"
}
```

`202` response:

```json
{
  "mfaRequired": true,
  "challengeId": "uuid",
  "method": "APP",
  "expiresAt": "2026-03-28T12:00:00.000Z",
  "codePreview": "123456"
}
```

### `POST /api/v1/auth/mfa/verify`

Request:

```json
{
  "challengeId": "uuid",
  "code": "123456"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Equipe MOVY",
    "email": "admin@movy.local",
    "role": "ADMIN"
  },
  "token": "jwt",
  "refreshToken": "opaque-token"
}
```

### `POST /api/v1/auth/refresh`

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Response:

```json
{
  "token": "jwt",
  "refreshToken": "new-opaque-token"
}
```

### `POST /api/v1/auth/logout`

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Response:

- `204 No Content`

### `GET /api/v1/auth/me`

Protected route.

Response:

```json
{
  "userId": "uuid",
  "role": "PASSENGER",
  "email": "ana@movy.local",
  "mfaEnabled": false
}
```

### `GET /api/v1/auth/sessions`

Protected route.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "deviceName": "MOVY Dashboard",
      "platform": "web",
      "lastSeenAt": "2026-03-28T12:00:00.000Z",
      "createdAt": "2026-03-28T11:40:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Health and operations

### `GET /api/v1/health`

Response:

```json
{
  "status": "ok",
  "service": "movy-backend",
  "environment": "development",
  "uptimeMs": 12345,
  "startedAt": "2026-03-28T11:30:00.000Z",
  "modules": ["auth", "admin", "drivers", "rides", "payments", "reviews", "notifications", "support"],
  "persistence": {
    "mode": "memory",
    "fallbackReason": "MOVY_DATA_MODE is not prisma"
  },
  "dependencies": {
    "persistence": {
      "name": "persistence",
      "status": "up",
      "detail": "MOVY_DATA_MODE is not prisma"
    },
    "redis": {
      "name": "redis",
      "status": "down",
      "detail": "connection refused"
    }
  }
}
```

### `GET /api/v1/overview`

Admin-only route.

Response:

```json
{
  "kpis": {
    "totalUsers": 4,
    "activeDrivers": 2,
    "activeRides": 1,
    "completedToday": 2,
    "totalRevenue": 148.9
  },
  "security": {
    "verifiedDrivers": 2,
    "openSosAlerts": 0,
    "openSafetyIncidents": 0,
    "openFraudSignals": 0
  },
  "operations": {
    "verifiedVehicles": 1,
    "openSupportTickets": 1,
    "activeSessions": 3,
    "mfaProtectedUsers": 1
  }
}
```

## Ride estimates and booking

### `POST /api/v1/rides/estimates`

Protected for `PASSENGER` or `ADMIN`.

Request:

```json
{
  "origin": {
    "address": "Av. Paulista, Bela Vista",
    "lat": -23.563099,
    "lng": -46.654419
  },
  "destination": {
    "address": "Pinheiros, Sao Paulo",
    "lat": -23.56674,
    "lng": -46.69297
  },
  "type": "INSTANT"
}
```

Response:

```json
{
  "estimate": {
    "id": "uuid",
    "passengerId": "uuid",
    "origin": {
      "address": "Av. Paulista, Bela Vista",
      "lat": -23.563099,
      "lng": -46.654419
    },
    "destination": {
      "address": "Pinheiros, Sao Paulo",
      "lat": -23.56674,
      "lng": -46.69297
    },
    "type": "INSTANT",
    "distanceKm": 3.94,
    "estimatedMinutes": 11,
    "suggestedPrice": 20.97,
    "minPrice": 19.29,
    "maxPrice": 22.65,
    "riskScore": 0.07,
    "riskLevel": "LOW",
    "pinRequired": false,
    "expiresAt": "2026-03-28T12:10:00.000Z",
    "createdAt": "2026-03-28T12:00:00.000Z"
  }
}
```

### `POST /api/v1/rides`

Protected for `PASSENGER` or `ADMIN`.

Supports two request modes:

1. Preferred estimate-to-book
2. Backward-compatible direct create

Preferred request:

```json
{
  "estimateId": "uuid"
}
```

Response:

```json
{
  "ride": {
    "id": "uuid",
    "passengerId": "uuid",
    "status": "REQUESTED",
    "suggestedPrice": 20.97,
    "boardingPin": "1234"
  },
  "fareEstimate": {
    "id": "uuid",
    "riskLevel": "LOW",
    "pinRequired": false
  },
  "candidates": [
    {
      "driver": {
        "id": "uuid",
        "businessName": "Carlos Executivo"
      },
      "driverUser": {
        "name": "Carlos Motorista",
        "rating": 4.8
      },
      "etaMinutes": 4,
      "recommendedPrice": 21.8
    }
  ],
  "risk": {
    "id": "uuid",
    "rideId": "uuid",
    "score": 0.07,
    "level": "LOW",
    "reasons": ["new_request"]
  }
}
```

Backward-compatible direct request:

```json
{
  "origin": {
    "address": "Av. Paulista, Bela Vista",
    "lat": -23.563099,
    "lng": -46.654419
  },
  "destination": {
    "address": "Pinheiros, Sao Paulo",
    "lat": -23.56674,
    "lng": -46.69297
  },
  "type": "INSTANT"
}
```

### `GET /api/v1/rides`

Protected route.

Example response:

```json
{
  "items": [
    {
      "id": "uuid",
      "status": "MATCHED",
      "type": "INSTANT",
      "origin": {
        "address": "Av. Paulista, Bela Vista"
      },
      "destination": {
        "address": "Pinheiros, Sao Paulo"
      },
      "suggestedPrice": 20.97,
      "sosTriggered": false
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `GET /api/v1/rides/:rideId/events`

Protected for admin, passenger owner or assigned driver.

Response:

```json
{
  "events": [
    {
      "id": "uuid",
      "rideId": "uuid",
      "type": "PIN_VERIFIED",
      "actorId": "uuid",
      "createdAt": "2026-03-28T12:00:00.000Z"
    }
  ],
  "risk": {
    "id": "uuid",
    "rideId": "uuid",
    "score": 0.07,
    "level": "LOW",
    "reasons": ["new_request"]
  },
  "tracking": [
    {
      "id": "uuid",
      "rideId": "uuid",
      "lat": -23.564,
      "lng": -46.661,
      "speedKph": 28,
      "recordedAt": "2026-03-28T12:10:00.000Z"
    }
  ]
}
```

## Ride lifecycle

Current allowed state path:

- `REQUESTED -> MATCHED -> ACCEPTED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED`

Alternative branch:

- cancellation can occur from allowed states according to backend policy

### `POST /api/v1/rides/:rideId/match`

Protected for `PASSENGER` or `ADMIN`.

Request:

```json
{
  "driverId": "uuid"
}
```

### `POST /api/v1/rides/:rideId/accept`

Protected for `DRIVER` or `ADMIN`.

Request:

```json
{}
```

### `POST /api/v1/rides/:rideId/checkin-pin`

Protected route.

Request:

```json
{
  "pin": "1234"
}
```

### `POST /api/v1/rides/:rideId/tracking`

Protected for ride actor or admin.

Request:

```json
{
  "lat": -23.564,
  "lng": -46.661,
  "speedKph": 28
}
```

Response:

```json
{
  "point": {
    "id": "uuid",
    "rideId": "uuid",
    "lat": -23.564,
    "lng": -46.661,
    "speedKph": 28,
    "recordedAt": "2026-03-28T12:10:00.000Z"
  },
  "totalPoints": 1
}
```

### `POST /api/v1/rides/:rideId/start`

Protected for `DRIVER` or `ADMIN`.

Request:

```json
{}
```

### `POST /api/v1/rides/:rideId/sos`

Protected route.

Request:

```json
{}
```

### `POST /api/v1/rides/:rideId/complete`

Protected for `DRIVER` or `ADMIN`.
Recommended with `Idempotency-Key`.

Request:

```json
{
  "method": "PIX"
}
```

Response:

```json
{
  "ride": {
    "id": "uuid",
    "status": "COMPLETED",
    "finalPrice": 21.81
  },
  "payment": {
    "id": "uuid",
    "rideId": "uuid",
    "method": "PIX",
    "total": 21.81,
    "platformFee": 3.93,
    "driverNet": 17.88,
    "status": "SETTLED"
  },
  "risk": {
    "id": "uuid",
    "level": "LOW",
    "score": 0.07
  }
}
```

## Driver operations

### `GET /api/v1/drivers`

Protected route.

Response excerpt:

```json
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "businessName": "Carlos Executivo",
      "basePricePerKm": 3.5,
      "coverageRadiusKm": 18,
      "available": true,
      "vehicleType": "Sedan",
      "serviceTypes": ["INSTANT", "SCHEDULED"],
      "safetyScore": 96,
      "kycStatus": "VERIFIED",
      "user": {
        "id": "uuid",
        "name": "Carlos Motorista",
        "rating": 4.8,
        "walletBalance": 17.88
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `PATCH /api/v1/drivers/:driverId`

Protected for driver owner or admin.

Request:

```json
{
  "available": false,
  "basePricePerKm": 4.2
}
```

### `GET /api/v1/drivers/:driverId/vehicles`

Protected for driver owner or admin.

### `POST /api/v1/drivers/:driverId/vehicles`

Protected for driver owner or admin.

Request:

```json
{
  "make": "Toyota",
  "model": "Corolla",
  "color": "Prata",
  "plate": "MOV1234",
  "year": 2021,
  "verified": true
}
```

## Payments and wallet

### `GET /api/v1/payments`

Admin-only route.

### `GET /api/v1/payments/summary`

Admin-only route.

Response:

```json
{
  "totalRevenue": 148.9,
  "platformRevenue": 26.8,
  "driverRevenue": 122.1,
  "settledTrips": 7
}
```

### `GET /api/v1/wallet/me`

Protected route.

Response:

```json
{
  "balance": 17.88,
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "kind": "CREDIT",
      "amount": 17.88,
      "description": "Repasse liquido de corrida",
      "createdAt": "2026-03-28T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Notifications

### `GET /api/v1/notifications/:userId`

Protected for admin or the user owner.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Nova oportunidade",
      "message": "Nova corrida pronta para aceite.",
      "level": "INFO",
      "createdAt": "2026-03-28T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Support

### `GET /api/v1/support/tickets`

Admin-only route.

### `GET /api/v1/support/my-tickets`

Protected route for current user.

### `POST /api/v1/support/tickets`

Protected route.
Recommended with `Idempotency-Key`.

Request:

```json
{
  "rideId": "uuid",
  "category": "safety",
  "summary": "Solicitacao de revisao da corrida"
}
```

Response:

```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "rideId": "uuid",
  "category": "safety",
  "status": "OPEN",
  "summary": "Solicitacao de revisao da corrida",
  "createdAt": "2026-03-28T12:00:00.000Z"
}
```

### `PATCH /api/v1/support/tickets/:ticketId`

Admin-only route.

Request:

```json
{
  "status": "IN_REVIEW"
}
```

## Fraud and safety operations

### `GET /api/v1/admin/fraud-signals`

Admin-only paginated route.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "rideId": "uuid",
      "userId": "uuid",
      "type": "INVALID_PIN",
      "severity": "MEDIUM",
      "summary": "Passenger submitted an invalid boarding PIN",
      "status": "OPEN",
      "createdAt": "2026-03-28T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `GET /api/v1/admin/incidents`

Admin-only paginated route.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "rideId": "uuid",
      "reporterId": "uuid",
      "type": "SOS",
      "status": "OPEN",
      "summary": "Passenger triggered emergency flow",
      "createdAt": "2026-03-28T12:00:00.000Z",
      "updatedAt": "2026-03-28T12:02:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `PATCH /api/v1/admin/incidents/:incidentId`

Admin-only route.

Request:

```json
{
  "status": "ACKNOWLEDGED"
}
```

Response:

```json
{
  "id": "uuid",
  "rideId": "uuid",
  "reporterId": "uuid",
  "type": "SOS",
  "status": "ACKNOWLEDGED",
  "summary": "Passenger triggered emergency flow",
  "createdAt": "2026-03-28T12:00:00.000Z",
  "updatedAt": "2026-03-28T12:03:00.000Z"
}
```

### Fraud signal generation rules currently implemented

- `INVALID_PIN`: emitted when boarding PIN verification fails
- `ANOMALOUS_SPEED`: emitted when tracking shows unsafe velocity
- `SOS_ESCALATION`: emitted when SOS is triggered
- `PAYMENT_MISMATCH`: emitted when webhook or reconciliation detects financial discrepancies
- `MFA_FAILURE`: reserved contract type for identity hardening flows

### Safety incident generation rules currently implemented

- `SOS`: created when emergency flow is triggered
- `ANOMALOUS_SPEED`: created when on-trip telemetry exceeds policy thresholds
- `ROUTE_DEVIATION` and `ANOMALOUS_STOP`: reserved contract types for the next telemetry rules

## Webhooks and reconciliation

These routes are now implemented as live endpoints in the backend.

### `POST /api/v1/webhooks/payments`

- `POST /api/v1/webhooks/payments`

Provider-facing route with signature validation.

Required headers:

- `x-provider-name: <provider>`
- `x-provider-signature: <signature>`
- `x-request-id: <provider-event-id>` recommended for correlation

Signature rules:

- algorithm: `HMAC-SHA256`
- message: `JSON.stringify(requestBody)`
- secret source: `MOVY_PAYMENT_WEBHOOK_SECRET`
- non-production fallback: `movy-demo-webhook-secret`

Request:

```json
{
  "eventId": "provider-event-id",
  "eventType": "payment.captured",
  "occurredAt": "2026-03-28T12:00:00.000Z",
  "paymentReference": "provider-payment-id",
  "rideId": "uuid",
  "amount": 21.81,
  "currency": "BRL",
  "status": "SETTLED",
  "raw": {}
}
```

Success response:

```json
{
  "received": true,
  "eventId": "provider-event-id",
  "provider": "demo-gateway",
  "acknowledged": true,
  "processedAt": "2026-03-28T12:00:01.000Z"
}
```

Behavior rules:

- webhook processing is idempotent by `eventId`
- same `eventId` plus same payload replays the original response and returns `idempotent-replayed: true`
- raw payload must remain auditable
- invalid signature must return `401`
- accepted events always write an audit log
- `payment.failed`, `payment.refunded` and `payment.chargeback` open `PAYMENT_MISMATCH` fraud signals
- unknown `rideId` returns `202` with `acknowledged: false` and still opens a discrepancy signal

### `POST /api/v1/payments/reconciliation`

- `POST /api/v1/payments/reconciliation`

Admin-only route.

Request:

```json
{
  "provider": "demo-gateway",
  "windowStart": "2026-03-28T00:00:00.000Z",
  "windowEnd": "2026-03-28T23:59:59.999Z",
  "entries": [
    {
      "providerReference": "provider-payment-id",
      "rideId": "uuid",
      "grossAmount": 21.81,
      "fees": 0.5,
      "netAmount": 21.31,
      "status": "SETTLED"
    }
  ]
}
```

Expected response:

```json
{
  "reportId": "uuid",
  "provider": "demo-gateway",
  "windowStart": "2026-03-28T00:00:00.000Z",
  "windowEnd": "2026-03-28T23:59:59.999Z",
  "matched": 1,
  "mismatched": 0,
  "missingInternal": 0,
  "missingProvider": 0,
  "generatedAt": "2026-03-28T23:59:59.999Z",
  "discrepancies": []
}
```

Design rules:

- the route supports `Idempotency-Key`
- reconciliation must not mutate ride lifecycle directly
- discrepancies must open auditable finance tasks or fraud signals
- every run writes an audit log
- the current internal model does not yet persist provider references, so live matching currently falls back to `rideId + grossAmount + status`
- provider reference remains the external contract key and should become the primary internal key when payment-provider persistence is expanded

## Integration guidance

- Web passenger flow should prefer `rides/estimates -> rides`
- Web/mobile driver flow should use lifecycle routes in sequence, not jump states
- Admin surfaces should consume `overview`, `rides`, `payments/summary`, `support/tickets`, and notifications according to role
- Mobile and web should always send `Idempotency-Key` on ride booking, ride completion and support ticket creation
- External clients should treat `INVALID_RIDE_TRANSITION` as business conflict, not transient failure

## Current contract gaps

- No OpenAPI/Swagger document yet
- Pagination is formalized, but not yet exercised by frontend controls such as next/previous page navigation

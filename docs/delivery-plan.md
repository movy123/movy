# MOVY Delivery Plan

## Immediate execution order

1. Data foundation
2. Ride orchestration hardening
3. Safety and trust controls
4. Financial transparency
5. Passenger, driver and admin UX

## Sprint 1

- Expand Prisma schema to include `AuditLog`, `DeviceSession`, `PassengerProfile`, `Wallet`, `WalletTransaction`, `RideEvent`, `RiskScore`, `EmergencyContact` and `SupportTicket`.
- Introduce `/api/v1` routes while preserving current endpoints as compatibility wrappers.
- Add structured logging and request correlation id.
- Add idempotency support for ride creation and ride completion.

## Sprint 2

- Implement `FareEstimate` and `FareBreakdown`.
- Replace direct ride creation with estimate-to-book flow.
- Add risk policy gate for PIN requirement and contextual verification.
- Add driver wallet summary and payout ledger.

## Sprint 3

- Build passenger trip timeline, driver business dashboard and admin incident queue.
- Add websocket events for ride timeline and safety alerts.
- Add support ticket workflow tied to ride evidence.
- Add basic analytics events and operational metrics dashboard.

## Definition of done

- Critical flows validated by automated tests.
- API contracts documented.
- Security-sensitive actions audited.
- Failure cases tested for duplicate requests, external provider failure and invalid state transitions.

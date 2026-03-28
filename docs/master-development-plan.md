# MOVY Master Development Plan

## 1. Executive summary

MOVY already has a real monorepo foundation with `backend`, `frontend`, `mobile`, `infra`, Prisma schema, basic tests and local infrastructure. The project is not at zero. It is at an early MVP-plus stage with a functioning backend core, an operational-control web surface, and a conceptual mobile shell.

The central conclusion is:

- backend is the most mature layer
- docs are ahead of execution in some areas
- frontend is partially operational but still mixed with demo fallback behavior
- mobile is still a presentation shell, not a production feature app
- infra exists for local and CI validation, but production readiness is incomplete
- cross-cutting capabilities like observability, versioned contracts, risk workflow, support operations, and release governance are still incomplete

The recommended strategy is to keep MOVY as a modular monolith in the next phases, harden the backend contract and data foundation first, then evolve web and mobile around stable product flows.

## 2. Current project state

### 2.1 Verified current assets

- Monorepo with `backend`, `frontend`, `mobile`, `infra`, and `docs`
- Fastify backend with auth, drivers, rides, payments, reviews, notifications
- Prisma schema already containing `AuditLog`, `Wallet`, `WalletTransaction`, `RideEvent`, `RiskScore`, `SupportTicket`, and `FeatureFlag`
- Memory mode and Prisma mode supported in backend persistence
- Web dashboard connected to API with local fallback mode
- Mobile app implemented as a single Expo screen with institutional/operational messaging
- Local Docker Compose for PostgreSQL and Redis
- CI workflow running install, test, and build
- Backend automated tests passing

### 2.2 Verified execution status

- `npm test`: passing
- `npm run lint --workspace frontend`: passing
- `npm run build --workspace mobile`: passing
- `npm run build`: failing because `frontend` breaks during `next build` while collecting page data and cannot find `.next/build-manifest.json`

### 2.3 Maturity assessment by area

- Product: medium-low
- Architecture: medium
- Backend: medium
- Frontend: low-medium
- Mobile: low
- Security: low-medium
- Data and analytics: low
- QA: low-medium
- DevOps/SRE: low-medium
- Compliance/governance: low

## 3. Agents required

### 3.1 Core agents for immediate phase

1. Product agent
2. Architecture agent
3. Backend agent
4. Frontend agent
5. Mobile agent
6. Security agent
7. Data and analytics agent
8. DevOps/SRE agent
9. QA agent
10. Compliance/governance agent

### 3.2 Secondary agents for phase 2

11. UX/UI agent
12. Financial/monetization agent
13. Growth/operations agent
14. Market research agent

## 4. Role and deliverable of each agent

### Product agent

- define MVP boundaries
- formalize personas: passenger, driver, admin, operations
- prioritize journeys
- define acceptance criteria and business policies

### Architecture agent

- lock target modular structure
- define `/api/v1` contract strategy
- define domain ownership and integration boundaries
- formalize event model and shared invariants

### Backend agent

- stabilize ride lifecycle
- implement estimate-to-book flow
- enforce idempotency and transition guards
- enrich admin, wallet, support, and safety APIs

### Frontend agent

- replace mixed demo/dashboard behavior with real role-based surfaces
- fix production build failure
- implement authenticated operational UI
- consume stable versioned contracts

### Mobile agent

- split app into passenger, driver, and safety modules
- implement auth and live ride flow
- connect to real APIs and realtime events

### UX/UI agent

- define high-confidence operational flows
- build reusable design system foundations
- standardize action states, incidents, alerts, and financial clarity

### Security agent

- define auth hardening, token lifecycle, device/session model
- implement rate limiting, audit coverage, and role protection
- define KYC and risk policy checkpoints

### Data and analytics agent

- define event taxonomy
- define operational, financial, and trust metrics
- structure dashboards and future risk models

### DevOps/SRE agent

- fix CI build reliability
- define staging and production baselines
- introduce structured logs, tracing, metrics, and alerting
- define rollback and secret management strategy

### QA agent

- expand backend integration coverage
- add contract and E2E strategy
- validate critical flows and non-happy paths

### Compliance/governance agent

- define LGPD-sensitive data policies
- formalize retention, consent, auditability, and access control

### Financial/monetization agent

- define fare policy, split rules, driver ledger, payout model, and reconciliation

### Growth/operations agent

- define operational dashboards, support queues, lifecycle triggers, and retention signals

## 5. Dependencies mapped

## 5.1 Structural dependencies

- Product decisions depend on validated personas and operating model
- Architecture depends on confirmed MVP journeys and risk profile
- Frontend and mobile depend on stable API contracts and auth/session strategy
- Payments, wallet, and support depend on ride lifecycle consistency
- Analytics depends on domain events and event naming discipline
- Compliance depends on data inventory and sensitive-flow mapping
- QA depends on acceptance criteria, contracts, and stable environments
- DevOps depends on build determinism and environment configuration discipline

### 5.2 Technical dependencies already visible in the codebase

- Frontend depends on backend login endpoint and admin credentials even for dashboard hydration
- Frontend falls back to local mock data, which hides integration failures
- Backend persistence depends on environment-driven mode selection
- CI depends on all workspaces building in sequence, and today the frontend blocks the integrated build
- Wallet summary depends on ride completion flow
- Risk score currently depends only on a simple ride estimate heuristic

## 6. Gaps identified

### 6.1 Product gaps

- passenger journey not implemented as a real web or mobile flow
- driver journey not implemented as a real business-operating flow
- admin/operations journey still shallow
- no formal acceptance matrix per critical flow

### 6.2 Backend gaps

- no `/api/v1` versioning yet
- no explicit estimate resource like `FareEstimate`
- no idempotency support on sensitive write actions
- no explicit state machine enforcement for ride lifecycle
- no queue/outbox/retry layer for externalized events
- limited observability and no structured request correlation
- risk and support models exist only partially

### 6.3 Frontend gaps

- build instability in production build
- heavy reliance on fallback data masks real runtime failures
- no role-separated app structure
- no proper session/auth flow beyond demo login fetch
- no operational incident workflow surface

### 6.4 Mobile gaps

- single-screen shell only
- no feature modules, auth, ride state, wallet, or safety flows
- no realtime orchestration

### 6.5 Security and compliance gaps

- no MFA or step-up flows
- no refresh token/session lifecycle
- no rate limiting
- no secret-management abstraction
- no explicit consent, retention, or privacy-policy enforcement in code

### 6.6 Data and ops gaps

- no formal analytics taxonomy
- no production-grade telemetry
- no alert strategy
- no runbooks
- no staging deployment definition

### 6.7 QA gaps

- only one backend test file
- no frontend tests
- no mobile tests
- no E2E coverage
- no contract tests with persistence mode variation

## 7. Ideal execution order

### Phase 0. Stabilization and governance

1. Fix frontend production build failure
2. Define release gates for build, tests, and environment consistency
3. Lock target module map and API versioning strategy
4. Freeze critical domain terminology

### Phase 1. Core backend hardening

1. Introduce `/api/v1` contract layer
2. Add `FareEstimate` and estimate-to-book flow
3. Add state transition guards and idempotency
4. Add structured logging, correlation id, and audit expansion
5. Normalize error responses and authorization rules

### Phase 2. Data, trust, and financial foundation

1. Expand Prisma schema where still missing for sessions, documents, incidents, payout detail, and retention metadata
2. Implement wallet ledger and payout readiness
3. Implement support ticket flow linked to rides and incidents
4. Introduce foundational risk policy rules

### Phase 3. Frontend operationalization

1. Replace fallback-first behavior with real authenticated app shell
2. Create passenger, driver, and admin route groups
3. Build live ride timeline, operations dashboard, and financial clarity screens

### Phase 4. Mobile operationalization

1. Create feature-based mobile structure
2. Implement auth and active ride experience
3. Implement safety actions, ride timeline, and wallet summary

### Phase 5. Platform resilience

1. Add Redis-backed queues/cache/realtime fan-out
2. Add telemetry, alerts, and runbooks
3. Define staging and production deployment patterns

### Phase 6. Growth and differentiation

1. Driver business intelligence
2. explainable pricing and trust UX
3. campaigns, referrals, and retention loops

## 8. Integration rules

### 8.1 Contract rules

- all new external endpoints must be created under `/api/v1`
- every write endpoint for critical flows must define auth, validation, idempotency behavior, and error contract
- frontend and mobile must consume documented contracts only

### 8.2 Domain rules

- no ride can be created without a prior estimate artifact once estimate-to-book is introduced
- ride state transitions must be explicit and validated
- payment, wallet, support, and analytics events must originate from authoritative ride transitions
- every security-sensitive action must generate audit evidence

### 8.3 Delivery rules

- no agent ships isolated artifacts without dependency mapping
- no UI merges without backend contract validation
- no backend critical change merges without integration tests
- no infrastructure change merges without rollback note

### 8.4 Data rules

- PII and safety evidence must have retention ownership
- analytics events must be versioned and named centrally
- derived dashboards cannot invent business logic inconsistent with backend truth

### 8.5 Quality rules

- build must pass at monorepo level
- critical flows require automated happy-path and failure-path tests
- fallback data can support local demos but cannot hide production integration defects

## 9. Risks and conflicts

- documentation can drift ahead of implementation
- frontend can appear healthy locally while production build stays broken
- memory mode can hide Prisma-specific defects
- security and compliance may remain declarative if not tied to explicit backlog items
- mobile can diverge from backend contracts if it starts before API stabilization
- payment and wallet logic can become inconsistent if ride state machine stays implicit

## 10. Corrective actions

- treat the frontend build failure as an immediate blocker
- promote the current docs into enforceable execution backlog
- make API versioning and domain contracts mandatory before broad UI expansion
- create a shared acceptance matrix for passenger, driver, admin, safety, and finance flows
- add cross-layer release checklist covering backend, frontend, mobile, infra, QA, and compliance

## 11. Unified master plan

### Immediate next sprint

1. Resolve frontend build failure
2. Introduce `/api/v1` compatibility strategy
3. formalize ride state machine and estimate-to-book contract
4. add request correlation and structured logging
5. expand tests for ride lifecycle, payment settlement, wallet, and authorization

### Sprint after stabilization

1. implement admin operations screens against real contracts
2. implement driver financial visibility and support flows
3. start mobile modularization with auth and active ride
4. define analytics event catalog and trust metrics

### Readiness gate before larger scale

- monorepo build green
- backend critical flows versioned and tested
- web and mobile using stable auth/session model
- observability baseline enabled
- audit and retention policies documented and partially enforced

## 12. Recommended next step

The next execution step for MOVY should be:

1. fix the frontend production build failure
2. formalize `/api/v1` and the ride lifecycle contract
3. convert the current dashboard and mobile shell into contract-driven product surfaces

Until these three items are in place, the project can evolve, but it will still be structurally vulnerable to integration drift.

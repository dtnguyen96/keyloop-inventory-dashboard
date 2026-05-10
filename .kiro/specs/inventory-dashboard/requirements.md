# Requirements: Intelligent Inventory Dashboard

## Overview
A RESTful backend API for dealership managers to view, filter, and act on vehicle inventory. Aging stock (>90 days in inventory) is automatically identified, and managers can log persistent actions against those vehicles.

---

## Requirements

### REQ-1: Inventory Listing with Filters

**User Story**
As a dealership manager, I want to retrieve a list of all vehicles in inventory with optional filters, so I can quickly find specific stock.

**Acceptance Criteria**
- [ ] `GET /api/vehicles` returns all vehicles in the inventory
- [ ] Supports query parameters: `make` (string), `model` (string), `minAge` (integer, days), `maxAge` (integer, days)
- [ ] `minAge` filters to vehicles where `daysInInventory >= minAge` — implemented as `addedAt <= NOW() - minAge days`
- [ ] `maxAge` filters to vehicles where `daysInInventory <= maxAge` — implemented as `addedAt >= NOW() - maxAge days`
- [ ] Filters are combinable (e.g., `?make=Toyota&minAge=30&maxAge=120`)
- [ ] `make` and `model` filters are case-insensitive
- [ ] Returns `400` if `minAge` or `maxAge` are non-integer or negative values
- [ ] Returns `400` if `minAge > maxAge` when both are provided
- [ ] Response includes each vehicle's `id`, `make`, `model`, `year`, `vin`, `colour`, `price`, `daysInInventory`, `isAging`, and `addedAt`
- [ ] `isAging` is `true` when `daysInInventory >= 90` (computed server-side, never stored)
- [ ] Returns an empty array (not an error) when no vehicles match filters
- [ ] Supports `page` and `limit` query params for pagination (default: page=1, limit=20)
- [ ] Response envelope includes `data`, `total`, `page`, and `limit` fields

---

### REQ-2: Aging Stock Identification

**User Story**
As a dealership manager, I want aging vehicles (in stock >90 days) to be clearly identified in the API response, so I can focus attention on slow-moving inventory.

**Acceptance Criteria**
- [ ] `GET /api/vehicles?minAge=90` returns only vehicles where `daysInInventory >= 90` (aging stock)
- [ ] `isAging` field is computed server-side based on `addedAt` date — never stored as a static flag
- [ ] `GET /api/vehicles/aging/summary` returns aggregate stats: total aging count, oldest vehicle age (days), average age of aging stock
- [ ] Aging threshold (90 days) is defined as a named constant `AGING_THRESHOLD_DAYS`, not a magic number
- [ ] The `aging/summary` endpoint uses the same `AGING_THRESHOLD_DAYS` constant for consistency

---

### REQ-3: Single Vehicle Detail

**User Story**
As a dealership manager, I want to retrieve full details for a single vehicle including its action history, so I can review what's been done about it.

**Acceptance Criteria**
- [ ] `GET /api/vehicles/:id` returns full vehicle details
- [ ] Response includes an `actions` array of all logged actions for that vehicle, ordered by `createdAt` descending
- [ ] Returns `404` with a descriptive error message if the vehicle does not exist

---

### REQ-4: Log an Action on a Vehicle

**User Story**
As a dealership manager, I want to log a status or proposed action against an aging vehicle, so there is a persistent record of what's being done about slow-moving stock.

**Acceptance Criteria**
- [ ] `POST /api/vehicles/:id/actions` creates a new action record for the vehicle
- [ ] Returns `403` with a descriptive error if the vehicle exists but is not aging (`daysInInventory < 90`)
- [ ] Request body requires: `actionType` (enum: `PRICE_REDUCTION`, `PROMOTION`, `TRANSFER`, `AUCTION`, `OTHER`) and `notes` (string, max 500 chars)
- [ ] `notes` is optional for all action types except `OTHER`
- [ ] Action records are append-only — no update or delete endpoints are exposed
- [ ] Response returns the created action with `id`, `vehicleId`, `actionType`, `notes`, and `createdAt`
- [ ] Returns `404` if the vehicle does not exist
- [ ] Returns `400` with validation errors if the request body is invalid

---

### REQ-5: Vehicle Data Persistence

**User Story**
As a system, I need vehicle and action data to be persisted across server restarts, so the dashboard reflects real state.

**Acceptance Criteria**
- [ ] All vehicle records are stored in a SQLite database via Drizzle ORM
- [ ] All action records are stored and associated to a vehicle via foreign key
- [ ] Database is seeded with at least 20 sample vehicles with varied `addedAt` dates (some >90 days old)
- [ ] Seed data includes at least 5 aging vehicles with existing actions

---

### REQ-6: Observability

**User Story**
As an operator, I want structured logs and a health check endpoint, so I can monitor the service.

**Acceptance Criteria**
- [ ] `GET /health` returns `{ status: "ok", uptime: <seconds> }` with HTTP 200
- [ ] All incoming requests are logged with method, path, status code, and response time (via pino)
- [ ] All unhandled errors are logged with stack trace before returning a `500` response
- [ ] No sensitive data (e.g., full request bodies with PII) is logged at default log level

---

## Out of Scope (MVP)
- Authentication / authorisation
- Multi-dealership / multi-tenancy
- Vehicle create/update/delete endpoints (inventory is managed externally)
- Real-time push updates (WebSockets)
- Frontend UI (stubbed via OpenAPI spec)

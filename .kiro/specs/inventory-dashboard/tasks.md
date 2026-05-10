# Tasks: Intelligent Inventory Dashboard

## Task List

- [x] 1. Project scaffolding and configuration
- [x] 2. Database schema and migrations
- [x] 3. Database seed data
- [x] 4. Shared types, constants, and error classes
- [ ] 5. Express app setup and middleware
- [ ] 6. Vehicle repository
- [ ] 7. Vehicle service
- [ ] 8. Vehicle router
- [ ] 9. Action repository
- [ ] 10. Action service
- [ ] 11. Action router
- [ ] 12. Health check endpoint
- [ ] 13. OpenAPI specification
- [ ] 14. Unit tests — vehicle service
- [ ] 15. Unit tests — action service
- [ ] 16. Integration tests — vehicle routes
- [ ] 17. Integration tests — action routes

---

## Task Details

### 1. Project scaffolding and configuration

Set up the project structure, package.json, TypeScript config, ESLint, Prettier, and Vitest config.

**Files to create:**
- `package.json` — dependencies: `express`, `better-sqlite3`, `drizzle-orm`, `zod`, `pino`, `pino-http`, `uuid`; devDependencies: `typescript`, `tsx`, `vitest`, `@types/*`, `eslint`, `prettier`, `drizzle-kit`
- `tsconfig.json` — strict mode, `moduleResolution: bundler`, `outDir: dist`
- `.eslintrc.json` — TypeScript ESLint rules
- `.prettierrc` — 2-space indent, single quotes, trailing commas
- `vitest.config.ts` — test environment config
- `.env.example` — `PORT`, `DATABASE_URL`, `NODE_ENV`, `LOG_LEVEL`
- `.gitignore` — `node_modules/`, `dist/`, `data/`, `.env`
- `src/config.ts` — reads and exports env vars with defaults; exports `AGING_THRESHOLD_DAYS = 90`

**Acceptance criteria:**
- `npm install` completes without errors
- `npm run build` compiles TypeScript without errors
- `npm run test` runs Vitest in single-pass mode

---

### 2. Database schema and migrations

Define the Drizzle ORM schema and generate the initial migration.

**Files to create:**
- `src/db/schema.ts` — Drizzle table definitions for `vehicles` and `vehicle_actions` matching the SQL in the design doc; UUID primary keys, `added_at` as ISO 8601 text
- `src/db/index.ts` — creates and exports the `better-sqlite3` database connection singleton; runs migrations on startup
- `src/db/migrations/` — generated migration SQL file via `npm run db:migrate`

**Acceptance criteria:**
- `npm run db:migrate` creates `data/inventory.db` with both tables and indexes
- Drizzle schema types are inferred and exported for use in repositories
- Re-running migrate is idempotent (no errors on second run)

---

### 3. Database seed data

Populate the database with realistic sample data for development and testing.

**Files to create:**
- `src/db/seed.ts` — inserts at least 20 vehicles with varied `addedAt` dates; at least 5 vehicles have `addedAt` older than 90 days; those 5 aging vehicles each have at least one existing action record

**Acceptance criteria:**
- `npm run db:seed` runs without errors
- After seeding, `GET /api/vehicles` returns 20+ vehicles
- `GET /api/vehicles/aging/summary` returns `totalAging >= 5`
- Re-running seed is safe (clears and re-inserts, or uses upsert)

---

### 4. Shared types, constants, and error classes

Define the shared TypeScript types, the `AppError` class, and the `AGING_THRESHOLD_DAYS` constant.

**Files to create:**
- `src/types/index.ts` — interfaces for `Vehicle`, `VehicleWithActions`, `VehicleAction`, `PaginatedResponse<T>`, `AgingSummary`; `ActionType` enum (`PRICE_REDUCTION`, `PROMOTION`, `TRANSFER`, `AUCTION`, `OTHER`)
- `src/errors.ts` — `AppError` class extending `Error` with `code: string`, `statusCode: number`, and `message`; named subclasses or factory functions for `VEHICLE_NOT_FOUND` (404), `VEHICLE_NOT_AGING` (403), `VALIDATION_ERROR` (400), `INTERNAL_ERROR` (500)

**Acceptance criteria:**
- All domain types are importable from `src/types/index.ts`
- `AppError` instances carry `code`, `statusCode`, and `message`
- `AGING_THRESHOLD_DAYS` is exported from `src/config.ts` and used everywhere the 90-day threshold appears

---

### 5. Express app setup and middleware

Bootstrap the Express application with middleware and router registration.

**Files to create:**
- `src/app.ts` — creates Express app; registers `pino-http` logger middleware; mounts routers at `/health`, `/api/vehicles`; registers global error handler last; exports `app` without calling `listen`
- `src/index.ts` — imports `app`, calls `app.listen` on `PORT`, logs startup message
- `src/middleware/logger.ts` — configures and exports `pino-http` middleware instance
- `src/middleware/errorHandler.ts` — Express error handler; catches `AppError` and returns its `statusCode`/`code`/`message`; catches unknown errors, logs stack, returns `500 INTERNAL_ERROR`; matches the error response shape in the design doc

**Acceptance criteria:**
- `npm run dev` starts the server and logs a startup message
- Any unhandled thrown `AppError` is returned as the correct JSON error shape
- Any unhandled unknown error returns `{ error: { code: "INTERNAL_ERROR", statusCode: 500, message: "..." } }`
- Request logs appear for every HTTP request

---

### 6. Vehicle repository

All database queries for the `vehicles` table. No business logic.

**Files to create:**
- `src/modules/vehicles/vehicle.repository.ts`
  - `findMany(filters, pagination)` — builds Drizzle query with optional `WHERE` clauses for `make` (LIKE, case-insensitive), `model` (LIKE, case-insensitive), and date bounds derived from `minAge`/`maxAge`; returns `{ rows, total }`
  - `findById(id)` — returns single vehicle row or `undefined`
  - `getAgingStats(thresholdDays)` — returns `{ totalAging, oldestAgeDays, averageAgeDays }` using `julianday()` arithmetic

**Acceptance criteria:**
- `findMany` with no filters returns all vehicles
- `findMany` with `make` filter is case-insensitive
- `findMany` with `minAge=90` returns only vehicles where `addedAt <= NOW() - 90 days`
- `findById` returns `undefined` for a non-existent ID
- `getAgingStats` returns correct counts after seed data is loaded

---

### 7. Vehicle service

Business logic for vehicle operations: filter translation, `daysInInventory`/`isAging` computation, pagination envelope, aging summary.

**Files to create:**
- `src/modules/vehicles/vehicle.service.ts`
  - `list(filters, pagination)` — translates `minAge`/`maxAge` to date bounds, calls repository, maps each row to add `daysInInventory` and `isAging`, returns `PaginatedResponse<Vehicle>`
  - `getById(id)` — calls repository, throws `VEHICLE_NOT_FOUND` if missing, returns `VehicleWithActions`
  - `getAgingSummary()` — delegates to repository, returns `AgingSummary`
  - `computeIsAging(addedAt)` — pure function; returns `{ daysInInventory, isAging }`

**Acceptance criteria:**
- `computeIsAging` returns `isAging: true` for a date 91+ days ago
- `computeIsAging` returns `isAging: false` for a date 89 days ago
- `list` returns correct pagination metadata (`total`, `page`, `limit`)
- `getById` throws `AppError` with code `VEHICLE_NOT_FOUND` for unknown ID

---

### 8. Vehicle router

HTTP layer for vehicle endpoints. Parses and validates inputs, calls service, sends responses.

**Files to create:**
- `src/modules/vehicles/vehicle.schema.ts` — Zod schemas for `listVehiclesQuery` (make, model, minAge, maxAge, page, limit with defaults and constraints) and validates `minAge <= maxAge` when both present
- `src/modules/vehicles/vehicle.router.ts` — Express router with:
  - `GET /` → `VehicleService.list`
  - `GET /aging/summary` → `VehicleService.getAgingSummary` (declared **before** `/:id`)
  - `GET /:id` → `VehicleService.getById`

**Acceptance criteria:**
- `GET /api/vehicles` returns `{ data, total, page, limit }`
- `GET /api/vehicles?minAge=abc` returns `400 VALIDATION_ERROR`
- `GET /api/vehicles?minAge=100&maxAge=50` returns `400 VALIDATION_ERROR`
- `GET /api/vehicles/aging/summary` is not matched as `/:id`
- `GET /api/vehicles/<unknown-id>` returns `404 VEHICLE_NOT_FOUND`

---

### 9. Action repository

All database queries for the `vehicle_actions` table. No business logic.

**Files to create:**
- `src/modules/actions/action.repository.ts`
  - `create(vehicleId, payload)` — inserts a new action row with a UUID v4 `id` and current timestamp; returns the created row
  - `findByVehicleId(vehicleId)` — returns all actions for a vehicle ordered by `created_at DESC`

**Acceptance criteria:**
- `create` returns the full action record including generated `id` and `createdAt`
- `findByVehicleId` returns actions in descending `createdAt` order
- `findByVehicleId` returns an empty array for a vehicle with no actions

---

### 10. Action service

Business logic for action creation, including the aging guard.

**Files to create:**
- `src/modules/actions/action.service.ts`
  - `create(vehicleId, payload)` — fetches vehicle via `VehicleRepository.findById`; throws `VEHICLE_NOT_FOUND` if missing; computes `daysInInventory`; throws `VEHICLE_NOT_AGING` (403) if `daysInInventory < AGING_THRESHOLD_DAYS`; delegates to `ActionRepository.create`; returns created action

**Acceptance criteria:**
- Throws `VEHICLE_NOT_FOUND` for unknown vehicle ID
- Throws `VEHICLE_NOT_AGING` when vehicle has `daysInInventory < 90`
- Successfully creates and returns action for an aging vehicle
- `AGING_THRESHOLD_DAYS` constant is used for the guard check (not a hardcoded `90`)

---

### 11. Action router

HTTP layer for the action endpoint.

**Files to create:**
- `src/modules/actions/action.schema.ts` — Zod schema for `createActionBody`: `actionType` (enum), `notes` (optional string max 500 chars, required when `actionType === 'OTHER'`)
- `src/modules/actions/action.router.ts` — Express router (mounted at `/api/vehicles/:id/actions`):
  - `POST /` → validates body, calls `ActionService.create`, returns `201` with created action

**Acceptance criteria:**
- `POST` with valid body on aging vehicle returns `201` with action record
- `POST` with missing `actionType` returns `400 VALIDATION_ERROR`
- `POST` with `actionType: OTHER` and no `notes` returns `400 VALIDATION_ERROR`
- `POST` on non-aging vehicle returns `403 VEHICLE_NOT_AGING`
- `POST` on unknown vehicle returns `404 VEHICLE_NOT_FOUND`

---

### 12. Health check endpoint

Simple liveness endpoint.

**Files to create / update:**
- `src/app.ts` — add `GET /health` route returning `{ status: "ok", uptime: process.uptime() }`

**Acceptance criteria:**
- `GET /health` returns HTTP 200
- Response body matches `{ status: "ok", uptime: <number> }`

---

### 13. OpenAPI specification

Document the full API contract as an OpenAPI 3.0 YAML file to stub the frontend layer.

**Files to create:**
- `docs/openapi.yaml` — covers all 5 endpoints (`GET /health`, `GET /api/vehicles`, `GET /api/vehicles/aging/summary`, `GET /api/vehicles/:id`, `POST /api/vehicles/:id/actions`); includes all query parameters, request/response schemas, and error responses; served via `swagger-ui-express` at `GET /api-docs`

**Acceptance criteria:**
- `GET /api-docs` renders Swagger UI after server starts
- All endpoints, parameters, and schemas are documented
- Error response shape matches the `AppError` JSON structure

---

### 14. Unit tests — vehicle service

**Files to create:**
- `tests/unit/vehicle.service.test.ts` — mocks `VehicleRepository`; tests:
  - `computeIsAging` returns correct values at boundary (89, 90, 91 days)
  - `list` maps repository rows to include `daysInInventory` and `isAging`
  - `list` returns correct pagination envelope
  - `getById` throws `VEHICLE_NOT_FOUND` for unknown ID
  - `getAgingSummary` returns repository result

**Acceptance criteria:**
- All tests pass with `npm run test`
- Repository is fully mocked — no real DB calls

---

### 15. Unit tests — action service

**Files to create:**
- `tests/unit/action.service.test.ts` — mocks `VehicleRepository` and `ActionRepository`; tests:
  - Throws `VEHICLE_NOT_FOUND` for unknown vehicle
  - Throws `VEHICLE_NOT_AGING` when `daysInInventory < 90`
  - Successfully creates action for aging vehicle
  - Returns created action record

**Acceptance criteria:**
- All tests pass with `npm run test`
- No real DB calls

---

### 16. Integration tests — vehicle routes

**Files to create:**
- `tests/integration/vehicles.test.ts` — uses a real in-memory or temp SQLite DB; seeds test data before each suite; tests:
  - `GET /api/vehicles` returns paginated list
  - `GET /api/vehicles?make=Toyota` filters correctly (case-insensitive)
  - `GET /api/vehicles?minAge=90` returns only aging vehicles
  - `GET /api/vehicles?minAge=abc` returns 400
  - `GET /api/vehicles?minAge=100&maxAge=50` returns 400
  - `GET /api/vehicles/aging/summary` returns correct aggregate stats
  - `GET /api/vehicles/:id` returns vehicle with actions array
  - `GET /api/vehicles/<unknown>` returns 404

**Acceptance criteria:**
- All tests pass with `npm run test`
- Tests are isolated — each suite sets up and tears down its own DB state

---

### 17. Integration tests — action routes

**Files to create:**
- `tests/integration/actions.test.ts` — uses a real in-memory or temp SQLite DB; seeds test data; tests:
  - `POST /api/vehicles/:id/actions` on aging vehicle returns 201 with action
  - `POST` on non-aging vehicle returns 403
  - `POST` on unknown vehicle returns 404
  - `POST` with invalid `actionType` returns 400
  - `POST` with `actionType: OTHER` and no `notes` returns 400
  - `POST` with `notes` exceeding 500 chars returns 400

**Acceptance criteria:**
- All tests pass with `npm run test`
- Tests are isolated from other test suites

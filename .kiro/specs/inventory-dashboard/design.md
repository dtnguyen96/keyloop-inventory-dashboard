# Design: Intelligent Inventory Dashboard

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        API Clients                          │
│          (cURL / OpenAPI spec / future frontend)            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                    Express.js Server                        │
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Middleware │  │            Route Modules              │  │
│  │             │  │                                       │  │
│  │ • pino HTTP │  │  /health        → HealthRouter        │  │
│  │   logger    │  │  /api/vehicles  → VehicleRouter       │  │
│  │ • errorHand │  │  /api/vehicles/:id/actions            │  │
│  │   ler       │  │               → ActionRouter          │  │
│  └─────────────┘  └──────────┬───────────────────────────┘  │
│                              │                              │
│              ┌───────────────▼───────────────┐             │
│              │         Service Layer          │             │
│              │                               │             │
│              │  VehicleService               │             │
│              │  • list() — filter + paginate │             │
│              │  • getById()                  │             │
│              │  • getAgingSummary()          │             │
│              │  • computeIsAging()           │             │
│              │                               │             │
│              │  ActionService                │             │
│              │  • create() — aging guard     │             │
│              └───────────────┬───────────────┘             │
│                              │                              │
│              ┌───────────────▼───────────────┐             │
│              │       Repository Layer         │             │
│              │                               │             │
│              │  VehicleRepository            │             │
│              │  ActionRepository             │             │
│              │  (Drizzle ORM queries only)   │             │
│              └───────────────┬───────────────┘             │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │ better-sqlite3
┌──────────────────────────────▼──────────────────────────────┐
│                    SQLite Database                          │
│                  (data/inventory.db)                        │
│                                                             │
│   vehicles table          vehicle_actions table             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Roles

### Express.js Server (`src/index.ts`, `src/app.ts`)
Bootstraps the HTTP server, registers middleware and routers. `app.ts` is kept separate from `index.ts` so the app instance can be imported in tests without binding to a port.

### Middleware (`src/middleware/`)
- **`logger.ts`** — pino-http middleware; logs every request with method, path, status, and response time in structured JSON
- **`errorHandler.ts`** — global Express error handler; catches all `AppError` instances and unhandled errors, logs stack traces, returns consistent JSON error shape

### Route Modules (`src/modules/*/`)
Thin HTTP layer only. Responsible for parsing query params and request bodies, calling the service, and sending the response. No business logic lives here.

### Service Layer
All business logic lives here:
- **`VehicleService`** — applies filter logic, computes `daysInInventory` and `isAging` on results, builds pagination envelope, calculates aging summary stats
- **`ActionService`** — enforces the aging guard (rejects `POST` if vehicle is not aging), delegates persistence to the repository

### Repository Layer
All Drizzle ORM queries. No business logic. Returns raw DB rows; the service layer maps them to domain types.

### SQLite Database
Single-file persistent store. Chosen for zero-config setup appropriate to this assessment scope. Drizzle ORM provides type-safe query building and migration management.

---

## Data Model

### `vehicles` table
```sql
CREATE TABLE vehicles (
  id         TEXT PRIMARY KEY,          -- UUID v4
  vin        TEXT NOT NULL UNIQUE,
  make       TEXT NOT NULL,
  model      TEXT NOT NULL,
  year       INTEGER NOT NULL,
  colour     TEXT NOT NULL,
  price      REAL NOT NULL,
  added_at   TEXT NOT NULL,             -- ISO 8601 UTC timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `vehicle_actions` table
```sql
CREATE TABLE vehicle_actions (
  id          TEXT PRIMARY KEY,         -- UUID v4
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id),
  action_type TEXT NOT NULL,            -- enum: PRICE_REDUCTION | PROMOTION | TRANSFER | AUCTION | OTHER
  notes       TEXT,                     -- nullable, max 500 chars
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vehicle_actions_vehicle_id ON vehicle_actions(vehicle_id);
CREATE INDEX idx_vehicles_added_at ON vehicles(added_at);  -- supports age-based filtering
```

**Key decisions:**
- `isAging` is **not stored** — computed at query time from `added_at`
- `added_at` is indexed to make age-range filter queries efficient
- UUIDs as primary keys — avoids sequential ID enumeration, portable if migrated to Postgres later
- SQLite stores timestamps as ISO 8601 strings; date arithmetic uses SQLite's `julianday()` function

---

## Data Flow

### GET /api/vehicles (with filters)

```
Client
  │
  ├─ GET /api/vehicles?make=Toyota&minAge=30&maxAge=120&page=1&limit=20
  │
VehicleRouter
  ├─ Parse + validate query params via Zod schema
  ├─ Return 400 if validation fails
  │
VehicleService.list(filters, pagination)
  ├─ Translate minAge/maxAge to date bounds:
  │    minDate = NOW() - maxAge days  (addedAt >= minDate)
  │    maxDate = NOW() - minAge days  (addedAt <= maxDate)
  ├─ Call VehicleRepository.findMany(filters, pagination)
  │
VehicleRepository.findMany()
  ├─ Build Drizzle query with WHERE clauses for make, model, date bounds
  ├─ Run COUNT query for total
  ├─ Run paginated SELECT
  │
VehicleService (map results)
  ├─ For each row: compute daysInInventory = floor((NOW() - addedAt) / 86400)
  ├─ Compute isAging = daysInInventory >= AGING_THRESHOLD_DAYS (90)
  │
VehicleRouter
  └─ Return { data: [...], total, page, limit }
```

### POST /api/vehicles/:id/actions

```
Client
  │
  ├─ POST /api/vehicles/:id/actions  { actionType, notes }
  │
ActionRouter
  ├─ Parse + validate body via Zod schema
  ├─ Return 400 if validation fails
  │
ActionService.create(vehicleId, payload)
  ├─ Call VehicleRepository.findById(vehicleId)
  ├─ Return 404 if not found
  ├─ Compute daysInInventory for vehicle
  ├─ Return 403 if daysInInventory < AGING_THRESHOLD_DAYS
  ├─ Call ActionRepository.create(vehicleId, payload)
  │
ActionRouter
  └─ Return 201 with created action record
```

### GET /api/vehicles/aging/summary

```
Client
  │
  ├─ GET /api/vehicles/aging/summary
  │
VehicleRouter → VehicleService.getAgingSummary()
  ├─ Call VehicleRepository.getAgingStats(AGING_THRESHOLD_DAYS)
  │    SELECT COUNT(*), MAX(julianday('now') - julianday(added_at)),
  │           AVG(julianday('now') - julianday(added_at))
  │    WHERE added_at <= NOW() - 90 days
  │
VehicleRouter
  └─ Return { totalAging, oldestAgeDays, averageAgeDays }
```

---

## API Contract Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/vehicles` | List vehicles with optional filters + pagination |
| `GET` | `/api/vehicles/aging/summary` | Aggregate stats for aging stock |
| `GET` | `/api/vehicles/:id` | Single vehicle with action history |
| `POST` | `/api/vehicles/:id/actions` | Log action on an aging vehicle |

### Query Parameters — GET /api/vehicles
| Param | Type | Description |
|-------|------|-------------|
| `make` | string | Case-insensitive match |
| `model` | string | Case-insensitive match |
| `minAge` | integer ≥ 0 | Min days in inventory (inclusive) |
| `maxAge` | integer ≥ 0 | Max days in inventory (inclusive) |
| `page` | integer ≥ 1 | Page number (default: 1) |
| `limit` | integer 1–100 | Page size (default: 20) |

### Error Response Shape
```json
{
  "error": {
    "code": "VEHICLE_NOT_FOUND",
    "message": "Vehicle with id 'abc-123' does not exist",
    "statusCode": 404
  }
}
```

### Error Codes
| Code | Status | Trigger |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Invalid query params or request body |
| `VEHICLE_NOT_FOUND` | 404 | Vehicle ID does not exist |
| `VEHICLE_NOT_AGING` | 403 | Action attempted on non-aging vehicle |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

---

## Technology Choices

| Technology | Justification |
|-----------|---------------|
| **Node.js + TypeScript** | Strict typing catches data-shape bugs early; async I/O suits REST APIs well |
| **Express.js** | Minimal, well-understood framework; no magic, easy to reason about middleware order |
| **SQLite + better-sqlite3** | Zero-config persistent storage; synchronous driver simplifies async handling; trivially portable to Postgres via Drizzle |
| **Drizzle ORM** | Type-safe query builder; schema-as-code; lightweight with no runtime overhead vs. heavy ORMs |
| **Zod** | Runtime validation that mirrors TypeScript types; single source of truth for input shapes |
| **pino** | Structured JSON logging with minimal overhead; production-ready from day one |
| **Vitest** | ESM-native, fast, compatible with TypeScript without extra config; `vi.mock` for clean unit isolation |

---

## Observability Strategy

### Logging (pino)
- **Request logs** — every request logged with `method`, `url`, `statusCode`, `responseTime` via `pino-http`
- **Error logs** — all caught errors logged at `error` level with full stack trace before responding
- **Log levels** — `info` in production, `debug` in development (controlled via `LOG_LEVEL` env var)
- **Format** — JSON in production; pretty-printed via `pino-pretty` in development

### Health Check
`GET /health` returns:
```json
{ "status": "ok", "uptime": 142.3 }
```
Uptime in seconds allows basic liveness monitoring. Can be extended with DB connectivity check if needed.

### Error Tracing
- All errors are instances of `AppError` with a `code`, `message`, and `statusCode`
- Unhandled errors are caught by the global error handler, logged with stack, and returned as `INTERNAL_ERROR`
- Request IDs (via `uuid`) are attached to each request log and error log for correlation

### Future Observability (out of scope for MVP)
- Prometheus metrics endpoint (`/metrics`) for request counts, latency histograms
- OpenTelemetry tracing for distributed trace context if service is decomposed

---

## Key Design Decisions & Assumptions

1. **`isAging` is computed, not stored** — avoids stale data; the source of truth is always `added_at` + current time
2. **`GET /api/vehicles/aging/summary` is a static route** — declared before `GET /api/vehicles/:id` in the router to prevent Express matching `"aging"` as an `:id` param
3. **Actions restricted to aging vehicles** — enforced in the service layer, not the DB, so the constraint logic is testable without DB setup
4. **SQLite date arithmetic** — uses `julianday()` for age calculations in aggregate queries; JavaScript `Date` arithmetic for per-row `daysInInventory` computation in the service layer
5. **Pagination is always applied** — even without filters, to protect against large unbounded result sets
6. **No soft deletes** — vehicles and actions are permanent records; deletion is out of scope

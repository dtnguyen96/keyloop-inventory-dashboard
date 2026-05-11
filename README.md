# Intelligent Inventory Dashboard

A RESTful API for dealership managers to monitor vehicle stock, identify aging inventory, and log actions against slow-moving vehicles.

## Overview

- Browse and filter the full vehicle inventory (by make, model, and age)
- Automatically flags vehicles in stock for **90+ days** as aging
- Managers can log structured actions against aging vehicles (e.g. price reductions, promotions, transfers)
- Interactive API docs served at `/api-docs`

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- npm v10+

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development:

| Variable       | Default                  | Description                        |
|----------------|--------------------------|------------------------------------|
| `PORT`         | `3000`                   | Port the server listens on         |
| `DATABASE_URL` | `./data/inventory.db`    | Path to the SQLite database file   |
| `NODE_ENV`     | `development`            | Runtime environment                |
| `LOG_LEVEL`    | `info`                   | Pino log level                     |

### 3. Set up the database

Run migrations to create the schema, then seed it with sample data:

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

The server starts at `http://localhost:3000` with hot reload via `tsx watch`.

## Building for Production

```bash
# Compile TypeScript to dist/
npm run build

# Run the compiled output
npm start
```

## API Reference

Interactive Swagger UI is available at `http://localhost:3000/api-docs` once the server is running.

### Endpoints

| Method | Path                          | Description                                      |
|--------|-------------------------------|--------------------------------------------------|
| GET    | `/health`                     | Server liveness check                            |
| GET    | `/api/vehicles`               | List vehicles with optional filters and pagination |
| GET    | `/api/vehicles/aging/summary` | Aggregate stats for aging stock (90+ days)       |
| GET    | `/api/vehicles/:id`           | Get a single vehicle with its full action history |
| POST   | `/api/vehicles/:id/actions`   | Log an action against an aging vehicle           |

### Query Parameters — `GET /api/vehicles`

| Parameter | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `make`    | string  | Case-insensitive partial match on make           |
| `model`   | string  | Case-insensitive partial match on model          |
| `minAge`  | integer | Minimum days in inventory (inclusive)            |
| `maxAge`  | integer | Maximum days in inventory (inclusive)            |
| `page`    | integer | Page number, 1-indexed (default: `1`)            |
| `limit`   | integer | Results per page, max 100 (default: `20`)        |

### Action Types — `POST /api/vehicles/:id/actions`

| Value             | Notes required? |
|-------------------|-----------------|
| `PRICE_REDUCTION` | No              |
| `PROMOTION`       | No              |
| `TRANSFER`        | No              |
| `AUCTION`         | No              |
| `OTHER`           | **Yes**         |

Actions can only be logged against vehicles that are currently aging (`daysInInventory >= 90`).

### Example Requests

```bash
# List all aging vehicles (90+ days)
curl "http://localhost:3000/api/vehicles?minAge=90"

# Get aging stock summary
curl "http://localhost:3000/api/vehicles/aging/summary"

# Get a vehicle with its action history
curl "http://localhost:3000/api/vehicles/<vehicle-id>"

# Log a price reduction action
curl -X POST "http://localhost:3000/api/vehicles/<vehicle-id>/actions" \
  -H "Content-Type: application/json" \
  -d '{"actionType": "PRICE_REDUCTION", "notes": "Reducing by 5% to move stock"}'
```

## Testing

```bash
# Run all tests (unit + integration) once
npm run test

# Run tests in watch mode
npm run test:watch
```

Tests are organised into two suites:

- `tests/unit/` — isolated tests for services and repositories using an in-memory SQLite database
- `tests/integration/` — end-to-end route tests against a real Express app instance

## Project Structure

```
src/
├── index.ts              # Server bootstrap
├── app.ts                # Express app setup and middleware
├── config.ts             # Environment config
├── db/
│   ├── index.ts          # DB connection singleton
│   ├── schema.ts         # Drizzle ORM schema
│   ├── migrations/       # SQL migration files
│   └── seed.ts           # Sample data seeder
├── modules/
│   ├── vehicles/         # Vehicle routes, service, repository, schemas
│   └── actions/          # Action routes, service, repository, schemas
├── middleware/
│   ├── errorHandler.ts   # Global error handler
│   └── logger.ts         # Request logging (pino-http)
└── types/
    └── index.ts          # Shared TypeScript types
```

## Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Runtime    | Node.js + TypeScript    |
| Framework  | Express.js              |
| Database   | SQLite (better-sqlite3) |
| ORM        | Drizzle ORM             |
| Validation | Zod                     |
| Testing    | Vitest                  |
| Logging    | pino + pino-http        |
| API Docs   | OpenAPI 3.0 / Swagger UI |


---

## AI Collaboration Narrative

This project was built using [Kiro](https://kiro.dev), an AI-powered development environment. Below is an account of how I directed the AI, validated its output, and maintained quality throughout.

### Strategy for Guiding the AI

Rather than issuing open-ended prompts, I front-loaded the AI with structured context before any code was written. This took three forms:

**Steering documents** (`.kiro/steering/`) established non-negotiable constraints that applied to every interaction: The chosen tech stack and why, the project structure and naming conventions, and the product requirements and business rules. These acted as a persistent system prompt so I didn't have to repeat architectural decisions in every message.

**A formal spec** (`.kiro/specs/inventory-dashboard/`) broke the work into 17 discrete, sequenced tasks, from project scaffolding through to integration tests. Each task defined exactly which files to create, what the implementation should do, and explicit acceptance criteria. This gave the AI a clear, bounded scope for each step and made it easy to track progress.

**Layered architecture as a constraint.** By defining the router → service → repository separation upfront in the steering docs, I could hold the AI to that boundary throughout. If generated code violated it (e.g. a service reaching directly into the DB), it was straightforward to identify and correct.

### Process for Verifying and Refining Output

Each generated task was reviewed before moving to the next:

- **Read the diff, not just the summary.** I reviewed the actual file contents rather than trusting the AI's description of what it did. Edge cases like route ordering (`GET /aging/summary` before `GET /:id`) and boundary conditions (`>= 90` vs `> 90`) are easy to miss in a summary but visible in the code.
- **Run the tests immediately.** The spec included unit and integration tests as explicit tasks. After each implementation task I ran `npm run test` to confirm the acceptance criteria were met before proceeding. Failing tests surfaced issues early, when the context was still fresh.
- **Check types compile.** Running `npm run build` after each module caught type mismatches that tests alone wouldn't surface.
- **Probe the API manually.** For the HTTP layer I used the curl examples in the OpenAPI spec to exercise real responses, including error paths (non-aging vehicle, unknown ID, invalid query params).

Where output needed refinement, I gave targeted corrections rather than regenerating from scratch, pointing to the specific file, the specific behaviour, and the expected outcome.

### Ensuring Final Quality

Quality was enforced at multiple levels:


- **Test coverage across layers.** Unit tests verified business logic in isolation (mocked repositories, boundary conditions on `computeIsAging`). Integration tests verified the full HTTP stack against a real in-memory SQLite database, including all documented error responses.
- **The spec as a checklist.** Each task had explicit acceptance criteria. Marking a task complete required those criteria to be demonstrably met. Not just that the file existed, but that the behaviour was correct.
- **OpenAPI as a contract.** The `docs/openapi.yaml` spec was written before the implementation was finalised and served as a source of truth for response shapes, error codes, and edge case behaviour. Any drift between the implementation and the spec was treated as a bug.
- **Steering docs as a review lens.** The conventions defined upfront (no DB access outside repositories, all errors as `AppError` instances, explicit return types on exports) gave me a concrete checklist to apply when reviewing generated code, independent of whether the tests passed.

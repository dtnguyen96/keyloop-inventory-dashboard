# Project Structure

```
service-scheduler/
├── .kiro/
│   └── steering/          # AI steering documents
├── src/
│   ├── index.ts           # App entry point, server bootstrap
│   ├── app.ts             # Express app setup, middleware registration
│   ├── config.ts          # Environment config and constants
│   ├── db/
│   │   ├── index.ts       # DB connection singleton
│   │   ├── schema.ts      # Drizzle ORM schema definitions
│   │   ├── migrations/    # SQL migration files
│   │   └── seed.ts        # Sample data seeder
│   ├── modules/
│   │   ├── vehicles/
│   │   │   ├── vehicle.router.ts    # Express routes
│   │   │   ├── vehicle.service.ts   # Business logic
│   │   │   ├── vehicle.repository.ts # DB queries
│   │   │   └── vehicle.schema.ts    # Zod validation schemas
│   │   └── actions/
│   │       ├── action.router.ts
│   │       ├── action.service.ts
│   │       ├── action.repository.ts
│   │       └── action.schema.ts
│   ├── middleware/
│   │   ├── errorHandler.ts  # Global error handler
│   │   └── logger.ts        # Request logging middleware
│   └── types/
│       └── index.ts         # Shared TypeScript types/interfaces
├── tests/
│   ├── unit/              # Unit tests for services and repositories
│   └── integration/       # Integration tests for API routes
├── docs/
│   ├── openapi.yaml       # OpenAPI 3.0 spec (frontend stub)
│   └── SYSTEM_DESIGN.md   # Architecture and design document
├── data/                  # SQLite database file (gitignored)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── vitest.config.ts
└── README.md
```

## Architecture Pattern
**Modular layered architecture** within a monolith:
- **Router** — HTTP concerns only (parsing, responding)
- **Service** — Business logic, orchestration, validation
- **Repository** — All database access, no business logic

## Key Conventions
- Each domain module (vehicles, actions) is self-contained under `src/modules/`
- No direct DB access outside of `*.repository.ts` files
- Services never import other services directly — compose at the router level if needed
- All errors thrown as typed `AppError` instances caught by the global error handler
- All route handlers are async and wrapped with error forwarding

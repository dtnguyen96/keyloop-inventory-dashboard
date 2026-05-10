# Tech Stack

## Chosen Approach
**Backend implementation** with a RESTful API and persistent database. Frontend is mocked/stubbed via OpenAPI spec and cURL examples.

## Stack
| Layer | Technology | Justification |
|-------|-----------|---------------|
| Runtime | Node.js (TypeScript) | Strongly typed, fast iteration, large ecosystem |
| Framework | Express.js | Lightweight, well-understood REST framework |
| Database | SQLite (via better-sqlite3) | Zero-config persistent storage, ideal for assessment scope |
| ORM/Query | Drizzle ORM | Type-safe SQL, lightweight, works well with SQLite |
| Validation | Zod | Runtime schema validation for request bodies |
| Testing | Vitest | Fast, ESM-native, compatible with TypeScript |
| API Docs | OpenAPI 3.0 (YAML) | Stubs the frontend layer as required |
| Logging | pino | Structured JSON logging, low overhead |

## Common Commands

```bash
# Install dependencies
npm install

# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests (single pass)
npm run test

# Run tests in watch mode
npm run test:watch

# Generate/apply DB migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed

# View OpenAPI docs (after server is running)
open http://localhost:3000/api-docs
```

## Environment Variables
```
PORT=3000
DATABASE_URL=./data/inventory.db
NODE_ENV=development
LOG_LEVEL=info
```

## Code Style
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line structures
- Explicit return types on all exported functions

import express from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { vehicleRouter } from './modules/vehicles/vehicle.router.js';
import { actionRouter } from './modules/actions/action.router.js';

// Load OpenAPI spec relative to the project root (works in both dev and compiled dist/)
const openapiSpec = yaml.load(
  readFileSync(join(process.cwd(), 'docs/openapi.yaml'), 'utf8'),
) as Record<string, unknown>;

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// Structured request logging (pino-http)
app.use(httpLogger);

// Parse JSON request bodies
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// OpenAPI docs — Swagger UI served at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Health check — simple liveness probe (full implementation in task 12)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Vehicle API routes
app.use('/api/vehicles', vehicleRouter);

// Action API routes (nested under vehicles)
app.use('/api/vehicles/:vehicleId/actions', actionRouter);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export { app };

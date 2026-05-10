import express from 'express';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { vehicleRouter } from './modules/vehicles/vehicle.router.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// Structured request logging (pino-http)
app.use(httpLogger);

// Parse JSON request bodies
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — simple liveness probe (full implementation in task 12)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Vehicle API routes
app.use('/api/vehicles', vehicleRouter);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export { app };

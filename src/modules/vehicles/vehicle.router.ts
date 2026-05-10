/**
 * Vehicle router — HTTP layer for vehicle endpoints.
 * Mounted at /api/vehicles in app.ts.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { ValidationError } from '../../errors.js';
import * as VehicleService from './vehicle.service.js';
import { listVehiclesQuerySchema } from './vehicle.schema.js';

const vehicleRouter = Router();

/**
 * GET /api/vehicles
 * Returns a paginated, optionally filtered list of vehicles.
 */
vehicleRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = listVehiclesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      return next(new ValidationError(message));
    }

    const { make, model, minAge, maxAge, page, limit } = parsed.data;

    const result = VehicleService.list(
      { make, model, minAge, maxAge },
      { page, limit },
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vehicles/aging/summary
 * Returns aggregate aging statistics.
 * Declared BEFORE /:id to prevent "aging" being matched as an id.
 */
vehicleRouter.get(
  '/aging/summary',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = VehicleService.getAgingSummary();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/vehicles/:id
 * Returns a single vehicle with its full action history.
 */
vehicleRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vehicle = VehicleService.getById(req.params.id);
      res.json(vehicle);
    } catch (err) {
      next(err);
    }
  },
);

export { vehicleRouter };

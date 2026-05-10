/**
 * Action router — HTTP layer for action endpoints.
 * Mounted at /api/vehicles/:vehicleId/actions in app.ts.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { ValidationError } from '../../errors.js';
import * as ActionService from './action.service.js';
import { createActionBodySchema } from './action.schema.js';

const actionRouter = Router({ mergeParams: true });

/**
 * POST /api/vehicles/:vehicleId/actions
 * Logs a new action against an aging vehicle.
 * Returns 201 with the created action record.
 */
actionRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createActionBodySchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      return next(new ValidationError(message));
    }

    const vehicleId = req.params.vehicleId;
    const action = ActionService.create(vehicleId, parsed.data);

    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

export { actionRouter };

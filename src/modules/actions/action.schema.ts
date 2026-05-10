/**
 * Zod validation schemas for action route inputs.
 */

import { z } from 'zod';
import { ActionType } from '../../types/index.js';

/**
 * Schema for the request body on POST /api/vehicles/:vehicleId/actions.
 * Requires `notes` when `actionType` is `OTHER`.
 */
export const createActionBodySchema = z
  .object({
    actionType: z.nativeEnum(ActionType, {
      required_error: 'actionType is required',
      invalid_type_error: 'actionType must be a valid ActionType',
    }),
    notes: z.string().max(500, 'notes must be 500 characters or fewer').optional(),
  })
  .refine(
    (data) => {
      if (data.actionType === ActionType.OTHER) {
        return data.notes !== undefined && data.notes.trim().length > 0;
      }
      return true;
    },
    { message: 'notes is required when actionType is OTHER', path: ['notes'] },
  );

export type CreateActionBody = z.infer<typeof createActionBodySchema>;

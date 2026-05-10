/**
 * Zod validation schemas for vehicle route inputs.
 */

import { z } from 'zod';

/**
 * Schema for query parameters on GET /api/vehicles.
 * Coerces string query params to the appropriate types,
 * applies defaults for pagination, and validates minAge <= maxAge.
 */
export const listVehiclesQuerySchema = z
  .object({
    make: z.string().optional(),
    model: z.string().optional(),
    minAge: z.coerce
      .number()
      .int('minAge must be an integer')
      .min(0, 'minAge must be >= 0')
      .optional(),
    maxAge: z.coerce
      .number()
      .int('maxAge must be an integer')
      .min(0, 'maxAge must be >= 0')
      .optional(),
    page: z.coerce
      .number()
      .int('page must be an integer')
      .min(1, 'page must be >= 1')
      .default(1),
    limit: z.coerce
      .number()
      .int('limit must be an integer')
      .min(1, 'limit must be >= 1')
      .max(100, 'limit must be <= 100')
      .default(20),
  })
  .refine(
    (data) => {
      if (data.minAge !== undefined && data.maxAge !== undefined) {
        return data.minAge <= data.maxAge;
      }
      return true;
    },
    { message: 'minAge must be <= maxAge', path: ['minAge'] },
  );

export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;

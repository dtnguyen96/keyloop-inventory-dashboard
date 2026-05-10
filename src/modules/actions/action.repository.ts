/**
 * Action repository — all database queries for the `vehicle_actions` table.
 * No business logic lives here; only data access.
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { vehicleActions, type VehicleAction } from '../../db/schema.js';

export interface CreateActionPayload {
  actionType: string;
  notes?: string | null;
}

/**
 * Inserts a new action row for the given vehicle.
 * Generates a UUID v4 `id`; `created_at` is set by the DB default.
 * Returns the full created row.
 */
export function create(vehicleId: string, payload: CreateActionPayload): VehicleAction {
  const id = crypto.randomUUID();

  db.insert(vehicleActions)
    .values({
      id,
      vehicleId,
      actionType: payload.actionType,
      notes: payload.notes ?? null,
    })
    .run();

  const row = db
    .select()
    .from(vehicleActions)
    .where(eq(vehicleActions.id, id))
    .get();

  // The insert succeeded so the row must exist
  return row!;
}

/**
 * Returns all actions for a vehicle ordered by `created_at DESC`.
 * Returns an empty array if the vehicle has no actions.
 */
export function findByVehicleId(vehicleId: string): VehicleAction[] {
  return db
    .select()
    .from(vehicleActions)
    .where(eq(vehicleActions.vehicleId, vehicleId))
    .orderBy(desc(vehicleActions.createdAt))
    .all();
}

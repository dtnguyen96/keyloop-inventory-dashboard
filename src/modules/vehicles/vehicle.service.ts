/**
 * Vehicle service — all business logic for vehicle operations.
 * Translates filters, computes derived fields (daysInInventory, isAging),
 * builds pagination envelopes, and enforces domain rules.
 */

import { desc, eq } from 'drizzle-orm';
import { AGING_THRESHOLD_DAYS } from '../../config.js';
import { db } from '../../db/index.js';
import { vehicleActions } from '../../db/schema.js';
import { VehicleNotFoundError } from '../../errors.js';
import type {
  AgingSummary,
  PaginatedResponse,
  Vehicle,
  VehicleAction,
  VehicleWithActions,
} from '../../types/index.js';
import { ActionType } from '../../types/index.js';
import * as repository from './vehicle.repository.js';
import type { VehicleFilters, VehiclePagination } from './vehicle.repository.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Computes the number of days a vehicle has been in inventory and whether
 * it is considered "aging" (>= AGING_THRESHOLD_DAYS).
 *
 * @param addedAt - ISO 8601 UTC timestamp string
 */
export function computeIsAging(addedAt: string): { daysInInventory: number; isAging: boolean } {
  const daysInInventory = Math.floor((Date.now() - new Date(addedAt).getTime()) / 86400000);
  const isAging = daysInInventory >= AGING_THRESHOLD_DAYS;
  return { daysInInventory, isAging };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/**
 * Maps a raw DB vehicle row to the domain Vehicle type by adding
 * the computed daysInInventory and isAging fields.
 */
function mapVehicleRow(row: {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  price: number;
  addedAt: string;
  createdAt: string;
}): Vehicle {
  const { daysInInventory, isAging } = computeIsAging(row.addedAt);
  return {
    id: row.id,
    vin: row.vin,
    make: row.make,
    model: row.model,
    year: row.year,
    colour: row.colour,
    price: row.price,
    addedAt: row.addedAt,
    createdAt: row.createdAt,
    daysInInventory,
    isAging,
  };
}

/**
 * Maps a raw DB vehicle_actions row to the domain VehicleAction type.
 */
function mapActionRow(row: {
  id: string;
  vehicleId: string;
  actionType: string;
  notes: string | null;
  createdAt: string;
}): VehicleAction {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    actionType: row.actionType as ActionType,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of vehicles, optionally filtered.
 * Adds daysInInventory and isAging to each result row.
 */
export function list(
  filters: VehicleFilters,
  pagination: VehiclePagination,
): PaginatedResponse<Vehicle> {
  const { rows, total } = repository.findMany(filters, pagination);

  return {
    data: rows.map(mapVehicleRow),
    total,
    page: pagination.page,
    limit: pagination.limit,
  };
}

/**
 * Returns a single vehicle with its full action history.
 * Throws VehicleNotFoundError if the vehicle does not exist.
 */
export function getById(id: string): VehicleWithActions {
  const row = repository.findById(id);

  if (row === undefined) {
    throw new VehicleNotFoundError(id);
  }

  // Query actions for this vehicle — action repository (task 9) will own this
  // query once implemented; for now we access the table directly.
  const actionRows = db
    .select()
    .from(vehicleActions)
    .where(eq(vehicleActions.vehicleId, id))
    .orderBy(desc(vehicleActions.createdAt))
    .all();

  const vehicle = mapVehicleRow(row);

  return {
    ...vehicle,
    actions: actionRows.map(mapActionRow),
  };
}

/**
 * Returns aggregate aging statistics for vehicles older than AGING_THRESHOLD_DAYS.
 */
export function getAgingSummary(): AgingSummary {
  const stats = repository.getAgingStats(AGING_THRESHOLD_DAYS);
  return {
    totalAging: stats.totalAging,
    oldestAgeDays: stats.oldestAgeDays,
    averageAgeDays: stats.averageAgeDays,
  };
}

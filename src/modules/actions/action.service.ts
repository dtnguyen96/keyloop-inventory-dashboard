/**
 * Action service — business logic for action creation.
 * Enforces the aging guard before delegating to the repository.
 */

import { AGING_THRESHOLD_DAYS } from '../../config.js';
import { VehicleNotAgingError, VehicleNotFoundError } from '../../errors.js';
import { ActionType, type VehicleAction } from '../../types/index.js';
import * as ActionRepository from './action.repository.js';
import type { CreateActionPayload } from './action.repository.js';
import * as VehicleRepository from '../vehicles/vehicle.repository.js';

/**
 * Creates an action for a vehicle, enforcing the aging guard.
 *
 * Throws VehicleNotFoundError (404) if the vehicle does not exist.
 * Throws VehicleNotAgingError (403) if the vehicle has been in inventory
 * fewer than AGING_THRESHOLD_DAYS days.
 */
export function create(vehicleId: string, payload: CreateActionPayload): VehicleAction {
  const vehicle = VehicleRepository.findById(vehicleId);

  if (vehicle === undefined) {
    throw new VehicleNotFoundError(vehicleId);
  }

  const daysInInventory = Math.floor(
    (Date.now() - new Date(vehicle.addedAt).getTime()) / 86400000,
  );

  if (daysInInventory < AGING_THRESHOLD_DAYS) {
    throw new VehicleNotAgingError(vehicleId);
  }

  const row = ActionRepository.create(vehicleId, payload);
  return { ...row, actionType: row.actionType as ActionType };
}

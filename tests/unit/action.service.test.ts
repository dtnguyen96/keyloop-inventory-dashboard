/**
 * Unit tests for action.service.ts
 * Mocks the vehicle and action repositories so no real database calls are made.
 */

import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/errors.js';

// ---------------------------------------------------------------------------
// Mock repositories before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../src/modules/vehicles/vehicle.repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/modules/actions/action.repository.js', () => ({
  create: vi.fn(),
}));

// Import after mocks are set up
const { create } = await import('../../src/modules/actions/action.service.js');
const vehicleRepository = await import('../../src/modules/vehicles/vehicle.repository.js');
const actionRepository = await import('../../src/modules/actions/action.repository.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function makeRepoVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vehicle-1',
    vin: 'VIN123456789',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    colour: 'Silver',
    price: 20000,
    addedAt: daysAgo(95),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCreatedAction(vehicleId = 'vehicle-1') {
  return {
    id: 'action-1',
    vehicleId,
    actionType: 'PRICE_REDUCTION',
    notes: null,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('create', () => {
  it('throws VEHICLE_NOT_FOUND (404) for an unknown vehicle ID', () => {
    vi.mocked(vehicleRepository.findById).mockReturnValue(undefined);

    expect(() => create('unknown-id', { actionType: 'PRICE_REDUCTION' })).toThrow(AppError);

    try {
      create('unknown-id', { actionType: 'PRICE_REDUCTION' });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VEHICLE_NOT_FOUND');
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it('throws VEHICLE_NOT_AGING (403) when vehicle has daysInInventory < 90', () => {
    vi.mocked(vehicleRepository.findById).mockReturnValue(
      makeRepoVehicle({ addedAt: daysAgo(45) }),
    );

    expect(() => create('vehicle-1', { actionType: 'PRICE_REDUCTION' })).toThrow(AppError);

    try {
      create('vehicle-1', { actionType: 'PRICE_REDUCTION' });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VEHICLE_NOT_AGING');
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it('throws VEHICLE_NOT_AGING (403) when vehicle has daysInInventory of 89', () => {
    vi.mocked(vehicleRepository.findById).mockReturnValue(
      makeRepoVehicle({ addedAt: daysAgo(89) }),
    );

    try {
      create('vehicle-1', { actionType: 'PRICE_REDUCTION' });
    } catch (err) {
      expect((err as AppError).code).toBe('VEHICLE_NOT_AGING');
    }
  });

  it('creates and returns action for a vehicle with daysInInventory >= 90', () => {
    const vehicle = makeRepoVehicle({ addedAt: daysAgo(95) });
    const expectedAction = makeCreatedAction();

    vi.mocked(vehicleRepository.findById).mockReturnValue(vehicle);
    vi.mocked(actionRepository.create).mockReturnValue(expectedAction);

    const result = create('vehicle-1', { actionType: 'PRICE_REDUCTION' });

    expect(result).toEqual(expectedAction);
  });

  it('delegates to ActionRepository.create with the correct vehicleId and payload', () => {
    const vehicle = makeRepoVehicle({ addedAt: daysAgo(100) });
    const payload = { actionType: 'PROMOTION', notes: 'Summer sale' };
    const expectedAction = makeCreatedAction();

    vi.mocked(vehicleRepository.findById).mockReturnValue(vehicle);
    vi.mocked(actionRepository.create).mockReturnValue(expectedAction);

    create('vehicle-1', payload);

    expect(actionRepository.create).toHaveBeenCalledWith('vehicle-1', payload);
  });

  it('allows action creation at exactly 90 days (boundary)', () => {
    const vehicle = makeRepoVehicle({ addedAt: daysAgo(90) });
    const expectedAction = makeCreatedAction();

    vi.mocked(vehicleRepository.findById).mockReturnValue(vehicle);
    vi.mocked(actionRepository.create).mockReturnValue(expectedAction);

    const result = create('vehicle-1', { actionType: 'AUCTION' });

    expect(result).toEqual(expectedAction);
  });
});

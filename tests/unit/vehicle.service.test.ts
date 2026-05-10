/**
 * Unit tests for vehicle.service.ts
 * Mocks the vehicle repository and DB so no real database calls are made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/errors.js';

// ---------------------------------------------------------------------------
// Mock the repository before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../src/modules/vehicles/vehicle.repository.js', () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  getAgingStats: vi.fn(),
}));

// Mock the DB used for action queries inside getById
vi.mock('../../src/db/index.js', () => {
  const selectMock = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
  });
  return { db: { select: selectMock } };
});

// Import after mocks are set up
const { computeIsAging, list, getById, getAgingSummary } = await import(
  '../../src/modules/vehicles/vehicle.service.js'
);
const repository = await import('../../src/modules/vehicles/vehicle.repository.js');

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
    addedAt: daysAgo(10),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeIsAging
// ---------------------------------------------------------------------------

describe('computeIsAging', () => {
  it('returns isAging: true for a date 91 days ago', () => {
    const result = computeIsAging(daysAgo(91));
    expect(result.isAging).toBe(true);
    expect(result.daysInInventory).toBeGreaterThanOrEqual(91);
  });

  it('returns isAging: true for a date 100 days ago', () => {
    const result = computeIsAging(daysAgo(100));
    expect(result.isAging).toBe(true);
  });

  it('returns isAging: false for a date 89 days ago', () => {
    const result = computeIsAging(daysAgo(89));
    expect(result.isAging).toBe(false);
    expect(result.daysInInventory).toBeLessThan(90);
  });

  it('returns isAging: false for a date 10 days ago', () => {
    const result = computeIsAging(daysAgo(10));
    expect(result.isAging).toBe(false);
  });

  it('returns isAging: true at exactly 90 days (boundary)', () => {
    // 90 days ago — exactly at threshold, should be aging
    const result = computeIsAging(daysAgo(90));
    expect(result.isAging).toBe(true);
    expect(result.daysInInventory).toBeGreaterThanOrEqual(90);
  });

  it('returns correct daysInInventory value', () => {
    const result = computeIsAging(daysAgo(45));
    // Allow ±1 for sub-millisecond timing
    expect(result.daysInInventory).toBeGreaterThanOrEqual(44);
    expect(result.daysInInventory).toBeLessThanOrEqual(46);
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('list', () => {
  beforeEach(() => {
    vi.mocked(repository.findMany).mockReset();
  });

  it('returns correct pagination metadata', () => {
    vi.mocked(repository.findMany).mockReturnValue({
      rows: [makeRepoVehicle()],
      total: 42,
    });

    const result = list({}, { page: 3, limit: 10 });

    expect(result.total).toBe(42);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('maps each row to include daysInInventory and isAging', () => {
    const agingVehicle = makeRepoVehicle({ addedAt: daysAgo(95) });
    const freshVehicle = makeRepoVehicle({ id: 'vehicle-2', addedAt: daysAgo(5) });

    vi.mocked(repository.findMany).mockReturnValue({
      rows: [agingVehicle, freshVehicle],
      total: 2,
    });

    const result = list({}, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].isAging).toBe(true);
    expect(result.data[0].daysInInventory).toBeGreaterThanOrEqual(95);
    expect(result.data[1].isAging).toBe(false);
    expect(result.data[1].daysInInventory).toBeLessThan(10);
  });

  it('returns empty data array when repository returns no rows', () => {
    vi.mocked(repository.findMany).mockReturnValue({ rows: [], total: 0 });

    const result = list({}, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('passes filters and pagination through to the repository', () => {
    vi.mocked(repository.findMany).mockReturnValue({ rows: [], total: 0 });

    list({ make: 'Honda', minAge: 30 }, { page: 2, limit: 5 });

    expect(repository.findMany).toHaveBeenCalledWith(
      { make: 'Honda', minAge: 30 },
      { page: 2, limit: 5 },
    );
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe('getById', () => {
  beforeEach(() => {
    vi.mocked(repository.findById).mockReset();
  });

  it('throws AppError with code VEHICLE_NOT_FOUND for unknown ID', async () => {
    vi.mocked(repository.findById).mockReturnValue(undefined);

    expect(() => getById('unknown-id')).toThrow(AppError);

    try {
      getById('unknown-id');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VEHICLE_NOT_FOUND');
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it('returns vehicle with actions array when vehicle exists', () => {
    const vehicle = makeRepoVehicle({ id: 'known-id' });
    vi.mocked(repository.findById).mockReturnValue(vehicle);

    const result = getById('known-id');

    expect(result.id).toBe('known-id');
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it('includes computed daysInInventory and isAging on returned vehicle', () => {
    const vehicle = makeRepoVehicle({ id: 'aging-id', addedAt: daysAgo(95) });
    vi.mocked(repository.findById).mockReturnValue(vehicle);

    const result = getById('aging-id');

    expect(result.isAging).toBe(true);
    expect(result.daysInInventory).toBeGreaterThanOrEqual(95);
  });
});

// ---------------------------------------------------------------------------
// getAgingSummary
// ---------------------------------------------------------------------------

describe('getAgingSummary', () => {
  afterEach(() => {
    vi.mocked(repository.getAgingStats).mockReset();
  });

  it('returns the repository result as AgingSummary', () => {
    vi.mocked(repository.getAgingStats).mockReturnValue({
      totalAging: 7,
      oldestAgeDays: 180,
      averageAgeDays: 110,
    });

    const result = getAgingSummary();

    expect(result.totalAging).toBe(7);
    expect(result.oldestAgeDays).toBe(180);
    expect(result.averageAgeDays).toBe(110);
  });

  it('delegates to repository with AGING_THRESHOLD_DAYS', () => {
    vi.mocked(repository.getAgingStats).mockReturnValue({
      totalAging: 0,
      oldestAgeDays: 0,
      averageAgeDays: 0,
    });

    getAgingSummary();

    // Should be called with 90 (AGING_THRESHOLD_DAYS from config)
    expect(repository.getAgingStats).toHaveBeenCalledWith(90);
  });
});

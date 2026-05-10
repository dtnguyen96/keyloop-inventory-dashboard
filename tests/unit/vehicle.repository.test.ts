/**
 * Unit tests for vehicle.repository.ts
 * Uses a real in-memory SQLite database to validate query logic.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// We need to swap out the db singleton before importing the repository.
// The repository imports `db` from '../../src/db/index.js', so we mock that
// module and replace it with an in-memory instance for each test suite.
// ---------------------------------------------------------------------------

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/db/migrations');

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite };
}

// We'll use vi.mock to intercept the db import in the repository
vi.mock('../../src/db/index.js', () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema: schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'src/db/migrations') });
  return { db, sqlite };
});

// Import repository AFTER mock is set up
const { findMany, findById, getAgingStats } = await import(
  '../../src/modules/vehicles/vehicle.repository.js'
);
const { db: testDb } = await import('../../src/db/index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeVehicle(overrides: Partial<schema.NewVehicle> = {}): schema.NewVehicle {
  return {
    id: crypto.randomUUID(),
    vin: `VIN${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    colour: 'Silver',
    price: 20000,
    addedAt: daysAgo(10),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test setup — clear tables before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  testDb.delete(schema.vehicleActions).run();
  testDb.delete(schema.vehicles).run();
});

// ---------------------------------------------------------------------------
// findMany
// ---------------------------------------------------------------------------

describe('findMany', () => {
  it('returns all vehicles when no filters are provided', () => {
    testDb.insert(schema.vehicles).values([makeVehicle(), makeVehicle(), makeVehicle()]).run();

    const { rows, total } = findMany({}, { page: 1, limit: 20 });

    expect(rows).toHaveLength(3);
    expect(total).toBe(3);
  });

  it('returns empty result when no vehicles exist', () => {
    const { rows, total } = findMany({}, { page: 1, limit: 20 });

    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('filters by make (case-insensitive)', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ make: 'Toyota' }),
        makeVehicle({ make: 'toyota' }),
        makeVehicle({ make: 'TOYOTA' }),
        makeVehicle({ make: 'Honda' }),
      ])
      .run();

    const { rows, total } = findMany({ make: 'toyota' }, { page: 1, limit: 20 });

    expect(total).toBe(3);
    expect(rows.every((r) => r.make.toLowerCase() === 'toyota')).toBe(true);
  });

  it('filters by model (case-insensitive)', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ model: 'Camry' }),
        makeVehicle({ model: 'camry' }),
        makeVehicle({ model: 'Corolla' }),
      ])
      .run();

    const { rows, total } = findMany({ model: 'CAMRY' }, { page: 1, limit: 20 });

    expect(total).toBe(2);
    expect(rows.every((r) => r.model.toLowerCase() === 'camry')).toBe(true);
  });

  it('filters by make and model together', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ make: 'Toyota', model: 'Camry' }),
        makeVehicle({ make: 'Toyota', model: 'Corolla' }),
        makeVehicle({ make: 'Honda', model: 'Camry' }),
      ])
      .run();

    const { rows, total } = findMany({ make: 'Toyota', model: 'Camry' }, { page: 1, limit: 20 });

    expect(total).toBe(1);
    expect(rows[0].make).toBe('Toyota');
    expect(rows[0].model).toBe('Camry');
  });

  it('filters by minAge — returns only vehicles added before the cutoff', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(120) }), // aging
        makeVehicle({ addedAt: daysAgo(95) }),  // aging
        makeVehicle({ addedAt: daysAgo(89) }),  // not aging
        makeVehicle({ addedAt: daysAgo(10) }),  // not aging
      ])
      .run();

    const { rows, total } = findMany({ minAge: 90 }, { page: 1, limit: 20 });

    expect(total).toBe(2);
    rows.forEach((r) => {
      const ageDays = (Date.now() - new Date(r.addedAt).getTime()) / 86400000;
      expect(ageDays).toBeGreaterThanOrEqual(90);
    });
  });

  it('filters by maxAge — returns only vehicles added after the cutoff', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(10) }),  // within range
        makeVehicle({ addedAt: daysAgo(25) }),  // within range
        makeVehicle({ addedAt: daysAgo(100) }), // too old
      ])
      .run();

    const { rows, total } = findMany({ maxAge: 30 }, { page: 1, limit: 20 });

    expect(total).toBe(2);
    rows.forEach((r) => {
      const ageDays = (Date.now() - new Date(r.addedAt).getTime()) / 86400000;
      expect(ageDays).toBeLessThanOrEqual(30);
    });
  });

  it('filters by both minAge and maxAge', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(10) }),  // too new
        makeVehicle({ addedAt: daysAgo(45) }),  // in range
        makeVehicle({ addedAt: daysAgo(60) }),  // in range
        makeVehicle({ addedAt: daysAgo(100) }), // too old
      ])
      .run();

    const { rows, total } = findMany({ minAge: 30, maxAge: 70 }, { page: 1, limit: 20 });

    expect(total).toBe(2);
  });

  it('respects pagination — returns correct page slice', () => {
    for (let i = 0; i < 5; i++) {
      testDb.insert(schema.vehicles).values(makeVehicle()).run();
    }

    const page1 = findMany({}, { page: 1, limit: 2 });
    const page2 = findMany({}, { page: 2, limit: 2 });
    const page3 = findMany({}, { page: 3, limit: 2 });

    expect(page1.rows).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page2.rows).toHaveLength(2);
    expect(page3.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('findById', () => {
  it('returns the vehicle when it exists', () => {
    const vehicle = makeVehicle({ id: 'test-id-123' });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const result = findById('test-id-123');

    expect(result).toBeDefined();
    expect(result?.id).toBe('test-id-123');
    expect(result?.make).toBe(vehicle.make);
  });

  it('returns undefined for a non-existent ID', () => {
    const result = findById('does-not-exist');

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAgingStats
// ---------------------------------------------------------------------------

describe('getAgingStats', () => {
  it('returns zero counts when no vehicles exist', () => {
    const stats = getAgingStats(90);

    expect(stats.totalAging).toBe(0);
    expect(stats.oldestAgeDays).toBe(0);
    expect(stats.averageAgeDays).toBe(0);
  });

  it('returns correct totalAging count', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(120) }), // aging
        makeVehicle({ addedAt: daysAgo(95) }),  // aging
        makeVehicle({ addedAt: daysAgo(89) }),  // not aging
        makeVehicle({ addedAt: daysAgo(10) }),  // not aging
      ])
      .run();

    const stats = getAgingStats(90);

    expect(stats.totalAging).toBe(2);
  });

  it('returns correct oldestAgeDays', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(120) }),
        makeVehicle({ addedAt: daysAgo(95) }),
      ])
      .run();

    const stats = getAgingStats(90);

    // oldestAgeDays should be approximately 120 (allow ±1 for timing)
    expect(stats.oldestAgeDays).toBeGreaterThanOrEqual(119);
    expect(stats.oldestAgeDays).toBeLessThanOrEqual(121);
  });

  it('returns correct averageAgeDays', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(100) }),
        makeVehicle({ addedAt: daysAgo(120) }),
      ])
      .run();

    const stats = getAgingStats(90);

    // average of 100 and 120 = 110 (allow ±1 for timing)
    expect(stats.averageAgeDays).toBeGreaterThanOrEqual(109);
    expect(stats.averageAgeDays).toBeLessThanOrEqual(111);
  });

  it('excludes non-aging vehicles from stats', () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(100) }), // aging
        makeVehicle({ addedAt: daysAgo(10) }),  // not aging — must not affect stats
      ])
      .run();

    const stats = getAgingStats(90);

    expect(stats.totalAging).toBe(1);
    expect(stats.oldestAgeDays).toBeGreaterThanOrEqual(99);
    expect(stats.oldestAgeDays).toBeLessThanOrEqual(101);
  });
});

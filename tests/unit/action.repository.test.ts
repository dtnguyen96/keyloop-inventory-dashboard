/**
 * Unit tests for action.repository.ts
 * Uses a real in-memory SQLite database to validate query logic.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// Mock the db singleton with an in-memory instance before importing the repo.
// ---------------------------------------------------------------------------

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/db/migrations');

vi.mock('../../src/db/index.js', () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema: schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'src/db/migrations') });
  return { db, sqlite };
});

// Import repository and test db AFTER mock is set up
const { create, findByVehicleId } = await import(
  '../../src/modules/actions/action.repository.js'
);
const { db: testDb } = await import('../../src/db/index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVehicle(overrides: Partial<schema.NewVehicle> = {}): schema.NewVehicle {
  return {
    id: crypto.randomUUID(),
    vin: `VIN${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    colour: 'Silver',
    price: 20000,
    addedAt: new Date().toISOString(),
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
// create
// ---------------------------------------------------------------------------

describe('create', () => {
  it('returns the full action record including generated id and createdAt', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const result = create(vehicle.id, { actionType: 'PRICE_REDUCTION' });

    expect(result.id).toBeDefined();
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.vehicleId).toBe(vehicle.id);
    expect(result.actionType).toBe('PRICE_REDUCTION');
    expect(result.notes).toBeNull();
    expect(result.createdAt).toBeDefined();
  });

  it('persists notes when provided', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const result = create(vehicle.id, {
      actionType: 'OTHER',
      notes: 'Scheduled for auction next week',
    });

    expect(result.notes).toBe('Scheduled for auction next week');
  });

  it('stores null notes when notes is omitted', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const result = create(vehicle.id, { actionType: 'PROMOTION' });

    expect(result.notes).toBeNull();
  });

  it('stores null notes when notes is explicitly null', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const result = create(vehicle.id, { actionType: 'TRANSFER', notes: null });

    expect(result.notes).toBeNull();
  });

  it('each created action gets a unique id', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const a1 = create(vehicle.id, { actionType: 'PRICE_REDUCTION' });
    const a2 = create(vehicle.id, { actionType: 'PROMOTION' });

    expect(a1.id).not.toBe(a2.id);
  });
});

// ---------------------------------------------------------------------------
// findByVehicleId
// ---------------------------------------------------------------------------

describe('findByVehicleId', () => {
  it('returns an empty array for a vehicle with no actions', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    const results = findByVehicleId(vehicle.id);

    expect(results).toEqual([]);
  });

  it('returns all actions belonging to the vehicle', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    create(vehicle.id, { actionType: 'PRICE_REDUCTION' });
    create(vehicle.id, { actionType: 'PROMOTION' });

    const results = findByVehicleId(vehicle.id);

    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.vehicleId).toBe(vehicle.id));
  });

  it('returns actions in descending createdAt order', () => {
    const vehicle = makeVehicle();
    testDb.insert(schema.vehicles).values(vehicle).run();

    // Insert with explicit timestamps to guarantee ordering
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const id3 = crypto.randomUUID();

    testDb
      .insert(schema.vehicleActions)
      .values([
        {
          id: id1,
          vehicleId: vehicle.id,
          actionType: 'PRICE_REDUCTION',
          notes: null,
          createdAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: id2,
          vehicleId: vehicle.id,
          actionType: 'PROMOTION',
          notes: null,
          createdAt: '2024-01-03T10:00:00.000Z',
        },
        {
          id: id3,
          vehicleId: vehicle.id,
          actionType: 'TRANSFER',
          notes: null,
          createdAt: '2024-01-02T10:00:00.000Z',
        },
      ])
      .run();

    const results = findByVehicleId(vehicle.id);

    expect(results).toHaveLength(3);
    // Most recent first
    expect(results[0].id).toBe(id2); // 2024-01-03
    expect(results[1].id).toBe(id3); // 2024-01-02
    expect(results[2].id).toBe(id1); // 2024-01-01
  });

  it('does not return actions belonging to a different vehicle', () => {
    const v1 = makeVehicle();
    const v2 = makeVehicle();
    testDb.insert(schema.vehicles).values([v1, v2]).run();

    create(v1.id, { actionType: 'PRICE_REDUCTION' });
    create(v2.id, { actionType: 'AUCTION' });

    const results = findByVehicleId(v1.id);

    expect(results).toHaveLength(1);
    expect(results[0].vehicleId).toBe(v1.id);
  });

  it('returns an empty array for a vehicle id that does not exist', () => {
    const results = findByVehicleId('non-existent-vehicle-id');

    expect(results).toEqual([]);
  });
});

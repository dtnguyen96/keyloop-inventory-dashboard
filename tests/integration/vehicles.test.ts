/**
 * Integration tests for vehicle routes.
 *
 * Uses a real in-memory SQLite database (not data/inventory.db) so tests are
 * fully isolated from production data. The db singleton is mocked before any
 * application modules are imported, ensuring every layer (router → service →
 * repository) operates against the same in-memory instance.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as http from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// Set up the in-memory DB BEFORE importing any application modules.
// The db singleton in src/db/index.ts is replaced here so every downstream
// import (repository, service, router) uses the same in-memory instance.
// ---------------------------------------------------------------------------

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/db/migrations');

const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER });

vi.mock('../../src/db/index.js', () => ({
  db: testDb,
  sqlite,
}));

// Import app AFTER the mock is registered
const { app } = await import('../../src/app.js');

// ---------------------------------------------------------------------------
// HTTP server helpers
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function makeVehicle(overrides: Partial<schema.NewVehicle> = {}): schema.NewVehicle {
  return {
    id: crypto.randomUUID(),
    vin: `VIN${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    make: 'Generic',
    model: 'Model',
    year: 2021,
    colour: 'White',
    price: 15000,
    addedAt: daysAgo(10),
    ...overrides,
  };
}

/** Wipe all rows before each test so suites are fully isolated. */
beforeEach(() => {
  testDb.delete(schema.vehicleActions).run();
  testDb.delete(schema.vehicles).run();
});

// ---------------------------------------------------------------------------
// Seed data used across multiple suites
// ---------------------------------------------------------------------------

function seedStandardVehicles() {
  const vehicles: schema.NewVehicle[] = [
    // Aging Toyota vehicles (> 90 days)
    makeVehicle({ id: 'toyota-aging-1', make: 'Toyota', model: 'Camry', addedAt: daysAgo(120) }),
    makeVehicle({ id: 'toyota-aging-2', make: 'Toyota', model: 'Corolla', addedAt: daysAgo(95) }),
    // Non-aging Toyota
    makeVehicle({ id: 'toyota-fresh-1', make: 'Toyota', model: 'RAV4', addedAt: daysAgo(30) }),
    // Honda vehicles
    makeVehicle({ id: 'honda-1', make: 'Honda', model: 'Civic', addedAt: daysAgo(50) }),
    makeVehicle({ id: 'honda-aging-1', make: 'Honda', model: 'Accord', addedAt: daysAgo(100) }),
    // Other makes
    makeVehicle({ id: 'ford-1', make: 'Ford', model: 'Focus', addedAt: daysAgo(5) }),
  ];

  testDb.insert(schema.vehicles).values(vehicles).run();
  return vehicles;
}

// ---------------------------------------------------------------------------
// GET /api/vehicles — paginated list
// ---------------------------------------------------------------------------

describe('GET /api/vehicles', () => {
  it('returns a paginated list with correct envelope shape', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(6);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it('each vehicle in the list includes daysInInventory and isAging', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles`);
    const body = await res.json();

    for (const vehicle of body.data) {
      expect(typeof vehicle.daysInInventory).toBe('number');
      expect(typeof vehicle.isAging).toBe('boolean');
    }
  });

  it('respects pagination params — page and limit', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?page=1&limit=2`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(6);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/vehicles?make=Toyota — case-insensitive make filter
// ---------------------------------------------------------------------------

describe('GET /api/vehicles?make=Toyota', () => {
  it('filters by make (exact case)', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?make=Toyota`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(3);
    body.data.forEach((v: { make: string }) => {
      expect(v.make.toLowerCase()).toBe('toyota');
    });
  });

  it('filters by make (lowercase — case-insensitive)', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?make=toyota`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(3);
  });

  it('filters by make (uppercase — case-insensitive)', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?make=TOYOTA`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(3);
  });

  it('returns empty list when no vehicles match the make', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?make=Mazda`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/vehicles?minAge=90 — aging filter
// ---------------------------------------------------------------------------

describe('GET /api/vehicles?minAge=90', () => {
  it('returns only vehicles with daysInInventory >= 90', async () => {
    seedStandardVehicles();

    const res = await fetch(`${baseUrl}/api/vehicles?minAge=90`);
    const body = await res.json();

    expect(res.status).toBe(200);
    // toyota-aging-1 (120d), toyota-aging-2 (95d), honda-aging-1 (100d) = 3
    expect(body.total).toBe(3);
    body.data.forEach((v: { daysInInventory: number; isAging: boolean }) => {
      expect(v.daysInInventory).toBeGreaterThanOrEqual(90);
      expect(v.isAging).toBe(true);
    });
  });

  it('returns empty list when no vehicles are aging', async () => {
    // Insert only fresh vehicles
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(10) }),
        makeVehicle({ addedAt: daysAgo(30) }),
      ])
      .run();

    const res = await fetch(`${baseUrl}/api/vehicles?minAge=90`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('GET /api/vehicles — validation errors', () => {
  it('returns 400 when minAge is not a number', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles?minAge=abc`);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 400 when minAge > maxAge', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles?minAge=100&maxAge=50`);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
  });

  it('returns 400 when minAge is negative', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles?minAge=-1`);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when page is less than 1', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles?page=0`);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/vehicles/aging/summary
// ---------------------------------------------------------------------------

describe('GET /api/vehicles/aging/summary', () => {
  it('returns correct aggregate stats', async () => {
    testDb
      .insert(schema.vehicles)
      .values([
        makeVehicle({ addedAt: daysAgo(120) }),
        makeVehicle({ addedAt: daysAgo(100) }),
        makeVehicle({ addedAt: daysAgo(10) }), // not aging — excluded
      ])
      .run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging/summary`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalAging).toBe(2);
    // oldestAgeDays ≈ 120 (allow ±1 for timing)
    expect(body.oldestAgeDays).toBeGreaterThanOrEqual(119);
    expect(body.oldestAgeDays).toBeLessThanOrEqual(121);
    // averageAgeDays ≈ 110 (allow ±1 for timing)
    expect(body.averageAgeDays).toBeGreaterThanOrEqual(109);
    expect(body.averageAgeDays).toBeLessThanOrEqual(111);
  });

  it('returns zeros when no aging vehicles exist', async () => {
    testDb
      .insert(schema.vehicles)
      .values([makeVehicle({ addedAt: daysAgo(10) })])
      .run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging/summary`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalAging).toBe(0);
    expect(body.oldestAgeDays).toBe(0);
    expect(body.averageAgeDays).toBe(0);
  });

  it('is not matched as /:id (static route takes priority)', async () => {
    // If "aging" were matched as an :id param, we'd get a 404 VEHICLE_NOT_FOUND.
    // A 200 with the summary shape confirms the static route wins.
    const res = await fetch(`${baseUrl}/api/vehicles/aging/summary`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('totalAging');
    expect(body).toHaveProperty('oldestAgeDays');
    expect(body).toHaveProperty('averageAgeDays');
  });
});

// ---------------------------------------------------------------------------
// GET /api/vehicles/:id — single vehicle with actions
// ---------------------------------------------------------------------------

describe('GET /api/vehicles/:id', () => {
  it('returns the vehicle with an actions array', async () => {
    const vehicle = makeVehicle({ id: 'known-vehicle-id', addedAt: daysAgo(120) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    // Insert an action for this vehicle
    testDb
      .insert(schema.vehicleActions)
      .values({
        id: crypto.randomUUID(),
        vehicleId: 'known-vehicle-id',
        actionType: 'PRICE_REDUCTION',
        notes: 'Reduced by 10%',
      })
      .run();

    const res = await fetch(`${baseUrl}/api/vehicles/known-vehicle-id`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('known-vehicle-id');
    expect(Array.isArray(body.actions)).toBe(true);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].actionType).toBe('PRICE_REDUCTION');
    expect(body.actions[0].notes).toBe('Reduced by 10%');
  });

  it('returns vehicle with empty actions array when no actions exist', async () => {
    const vehicle = makeVehicle({ id: 'no-actions-vehicle' });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/no-actions-vehicle`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('no-actions-vehicle');
    expect(Array.isArray(body.actions)).toBe(true);
    expect(body.actions).toHaveLength(0);
  });

  it('includes computed daysInInventory and isAging on the vehicle', async () => {
    const agingVehicle = makeVehicle({ id: 'aging-vehicle', addedAt: daysAgo(95) });
    testDb.insert(schema.vehicles).values(agingVehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isAging).toBe(true);
    expect(body.daysInInventory).toBeGreaterThanOrEqual(95);
  });

  it('returns 404 for an unknown vehicle ID', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/does-not-exist`);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('VEHICLE_NOT_FOUND');
    expect(body.error.statusCode).toBe(404);
    expect(body.error.message).toContain('does-not-exist');
  });
});

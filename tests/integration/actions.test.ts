/**
 * Integration tests for action routes.
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
// POST /api/vehicles/:id/actions
// ---------------------------------------------------------------------------

describe('POST /api/vehicles/:id/actions', () => {
  it('returns 201 with the created action when vehicle is aging', async () => {
    const vehicle = makeVehicle({ id: 'aging-vehicle', addedAt: daysAgo(100) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'PRICE_REDUCTION', notes: 'Reduced by 5%' }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.vehicleId).toBe('aging-vehicle');
    expect(body.actionType).toBe('PRICE_REDUCTION');
    expect(body.notes).toBe('Reduced by 5%');
    expect(typeof body.id).toBe('string');
    expect(typeof body.createdAt).toBe('string');
  });

  it('returns 201 with action when actionType has no notes (non-OTHER type)', async () => {
    const vehicle = makeVehicle({ id: 'aging-vehicle-2', addedAt: daysAgo(95) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle-2/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'AUCTION' }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.actionType).toBe('AUCTION');
  });

  it('returns 403 when vehicle is not aging (daysInInventory < 90)', async () => {
    const vehicle = makeVehicle({ id: 'fresh-vehicle', addedAt: daysAgo(30) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/fresh-vehicle/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'PROMOTION' }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('VEHICLE_NOT_AGING');
    expect(body.error.statusCode).toBe(403);
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 404 when vehicle does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/vehicles/does-not-exist/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'TRANSFER' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('VEHICLE_NOT_FOUND');
    expect(body.error.statusCode).toBe(404);
    expect(body.error.message).toContain('does-not-exist');
  });

  it('returns 400 when actionType is invalid', async () => {
    const vehicle = makeVehicle({ id: 'aging-vehicle-3', addedAt: daysAgo(120) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle-3/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'INVALID_TYPE' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 400 when actionType is OTHER and notes is missing', async () => {
    const vehicle = makeVehicle({ id: 'aging-vehicle-4', addedAt: daysAgo(110) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle-4/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'OTHER' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(body.error.message).toContain('notes');
  });

  it('returns 400 when notes exceeds 500 characters', async () => {
    const vehicle = makeVehicle({ id: 'aging-vehicle-5', addedAt: daysAgo(91) });
    testDb.insert(schema.vehicles).values(vehicle).run();

    const longNotes = 'a'.repeat(501);

    const res = await fetch(`${baseUrl}/api/vehicles/aging-vehicle-5/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'PRICE_REDUCTION', notes: longNotes }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(body.error.message).toContain('500');
  });
});

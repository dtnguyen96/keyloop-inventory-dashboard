/**
 * Vehicle repository — all database queries for the `vehicles` table.
 * No business logic lives here; only data access.
 */

import { and, between, count, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { vehicles, type Vehicle } from '../../db/schema.js';

export interface VehicleFilters {
  make?: string;
  model?: string;
  minAge?: number;
  maxAge?: number;
}

export interface VehiclePagination {
  page: number;
  limit: number;
}

export interface FindManyResult {
  rows: Vehicle[];
  total: number;
}

export interface AgingStats {
  totalAging: number;
  oldestAgeDays: number;
  averageAgeDays: number;
}

/**
 * Builds and executes a paginated query against the vehicles table.
 * Supports optional case-insensitive LIKE filters for make/model and
 * date-bound filters derived from minAge/maxAge (in days).
 */
export function findMany(
  filters: VehicleFilters,
  pagination: VehiclePagination,
): FindManyResult {
  const { make, model, minAge, maxAge } = filters;
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [];

  if (make !== undefined) {
    // LIKE with % on both sides; SQLite LIKE is case-insensitive for ASCII by default
    conditions.push(like(vehicles.make, `%${make}%`));
  }

  if (model !== undefined) {
    conditions.push(like(vehicles.model, `%${model}%`));
  }

  // minAge/maxAge translate to date bounds:
  //   minAge → maxDate = NOW() - minAge days  (addedAt <= maxDate)
  //   maxAge → minDate = NOW() - maxAge days  (addedAt >= minDate)
  if (minAge !== undefined && maxAge !== undefined) {
    const maxDate = new Date(Date.now() - minAge * 86400 * 1000).toISOString();
    const minDate = new Date(Date.now() - maxAge * 86400 * 1000).toISOString();
    conditions.push(between(vehicles.addedAt, minDate, maxDate));
  } else if (minAge !== undefined) {
    const maxDate = new Date(Date.now() - minAge * 86400 * 1000).toISOString();
    conditions.push(lte(vehicles.addedAt, maxDate));
  } else if (maxAge !== undefined) {
    const minDate = new Date(Date.now() - maxAge * 86400 * 1000).toISOString();
    conditions.push(gte(vehicles.addedAt, minDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // COUNT query for total
  const [{ value: total }] = db
    .select({ value: count() })
    .from(vehicles)
    .where(where)
    .all();

  // Paginated SELECT
  const rows = db
    .select()
    .from(vehicles)
    .where(where)
    .limit(limit)
    .offset(offset)
    .all();

  return { rows, total };
}

/**
 * Returns a single vehicle row by primary key, or `undefined` if not found.
 */
export function findById(id: string): Vehicle | undefined {
  return db
    .select()
    .from(vehicles)
    .where(sql`${vehicles.id} = ${id}`)
    .get() ?? undefined;
}

/**
 * Returns aggregate aging statistics for vehicles older than `thresholdDays`.
 * Uses SQLite's julianday() for date arithmetic.
 */
export function getAgingStats(thresholdDays: number): AgingStats {
  const cutoff = new Date(Date.now() - thresholdDays * 86400 * 1000).toISOString();

  const result = db
    .select({
      totalAging: count(),
      oldestAgeDays: sql<number>`MAX(julianday('now') - julianday(${vehicles.addedAt}))`,
      averageAgeDays: sql<number>`AVG(julianday('now') - julianday(${vehicles.addedAt}))`,
    })
    .from(vehicles)
    .where(lte(vehicles.addedAt, cutoff))
    .get();

  return {
    totalAging: result?.totalAging ?? 0,
    oldestAgeDays: result?.oldestAgeDays ?? 0,
    averageAgeDays: result?.averageAgeDays ?? 0,
  };
}

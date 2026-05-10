/**
 * Drizzle ORM schema definitions for the inventory database.
 * Matches the SQL data model defined in the design document.
 */

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const vehicles = sqliteTable(
  'vehicles',
  {
    id: text('id').primaryKey(), // UUID v4
    vin: text('vin').notNull().unique(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    colour: text('colour').notNull(),
    price: real('price').notNull(),
    addedAt: text('added_at').notNull(), // ISO 8601 UTC timestamp
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    addedAtIdx: index('idx_vehicles_added_at').on(table.addedAt),
  }),
);

export const vehicleActions = sqliteTable(
  'vehicle_actions',
  {
    id: text('id').primaryKey(), // UUID v4
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    actionType: text('action_type').notNull(), // PRICE_REDUCTION | PROMOTION | TRANSFER | AUCTION | OTHER
    notes: text('notes'), // nullable, max 500 chars
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    vehicleIdIdx: index('idx_vehicle_actions_vehicle_id').on(table.vehicleId),
  }),
);

// Inferred types for use in repositories and services
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type VehicleAction = typeof vehicleActions.$inferSelect;
export type NewVehicleAction = typeof vehicleActions.$inferInsert;

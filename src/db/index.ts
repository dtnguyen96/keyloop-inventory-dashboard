/**
 * Database connection singleton.
 * Creates the better-sqlite3 connection and runs Drizzle migrations on startup.
 */

import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { DATABASE_URL } from '../config.js';
import * as schema from './schema.js';

// Resolve the migrations folder relative to the project root (where the process runs)
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/db/migrations');

// Create the raw better-sqlite3 connection
const sqlite: BetterSqlite3.Database = new Database(DATABASE_URL);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

// Create the Drizzle ORM instance with the schema
export const db = drizzle(sqlite, { schema });

// Run migrations on startup — idempotent, safe to call multiple times
migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

export { sqlite };

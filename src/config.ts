/**
 * Application configuration — reads environment variables with sensible defaults.
 * All env access is centralised here; no other module should read process.env directly.
 */

export const PORT: number = parseInt(process.env['PORT'] ?? '3000', 10);

export const DATABASE_URL: string = process.env['DATABASE_URL'] ?? './data/inventory.db';

export const NODE_ENV: string = process.env['NODE_ENV'] ?? 'development';

export const LOG_LEVEL: string = process.env['LOG_LEVEL'] ?? 'info';

/** Number of days a vehicle must be in inventory before it is considered "aging". */
export const AGING_THRESHOLD_DAYS = 90;

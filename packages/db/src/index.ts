export { closeDb, getDb, type Database } from './client';
export * from './schema';
// Query helpers, re-exported so callers depend on @kiosk/db only (one drizzle-orm version). Add
// one here when a caller needs it.
export { eq, sql } from 'drizzle-orm';

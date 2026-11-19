export { closeDb, getDb, type Database } from './client';
export * from './schema';
// Query helpers, re-exported so callers depend on @kiosk/db only (one drizzle-orm version).
export { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

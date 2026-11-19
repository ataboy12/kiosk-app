import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (copy .env.example to .env).');
  return drizzle({ client: new Pool({ connectionString }), schema, casing: 'snake_case' });
}

export type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { db?: Database };

/**
 * One pool per process, reused across hot reloads in development. Created on first use, so
 * importing this module (for example during `next build`) never needs a database.
 */
export function getDb(): Database {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

/** Closes the pool (for scripts; the web server keeps it open). */
export async function closeDb() {
  await globalForDb.db?.$client.end();
  globalForDb.db = undefined;
}

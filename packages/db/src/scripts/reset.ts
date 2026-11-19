import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '../client';

// Drops every table and the migration journal. `pnpm db:reset` then re-applies migrations and reseeds.
if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to reset a production database.');
}

const db = getDb();
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`DROP SCHEMA public CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);
await closeDb();
console.log('Database emptied.');

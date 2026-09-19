import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { query, transaction } from './database.ts';

export async function runMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run database migrations.');
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const dir = path.join(process.cwd(), 'migrations');
  const files = (await readdir(dir)).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
  for (const filename of files) {
    const applied = await query<{filename:string}>('SELECT filename FROM schema_migrations WHERE filename=$1', [filename]);
    if (applied.length) continue;
    const sql = await readFile(path.join(dir, filename), 'utf8');
    try {
      await transaction(async client => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename]);
      });
    } catch (error) {
      throw new Error('Migration failed (' + filename + '): ' + (error as Error).message);
    }
  }
}

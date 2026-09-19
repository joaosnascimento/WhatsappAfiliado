import { runMigrations } from '../src/infrastructure/migrations.ts';
await runMigrations();
console.log('Database migrations applied.');
process.exit(0);

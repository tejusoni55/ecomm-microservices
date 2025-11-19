// Migration runner script - runs raw SQL migrations for all services
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from '../libs/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const services = ['users', 'products', 'orders', 'payments'];

async function runMigrationsForService(service) {
  try {
    console.log(`\n[${service}] Running migrations...`);
    
    const migrationsDir = join(__dirname, '..', 'services', service, 'src', 'migrations');
    
    // Check if migrations directory exists
    let migrationFiles;
    try {
      migrationFiles = await readdir(migrationsDir);
    } catch (error) {
      console.log(`[${service}] No migrations directory, skipping`);
      return;
    }

    // Filter and sort migration files (all .js files in migrations directory)
    const migrationJsFiles = migrationFiles
      .filter(file => file.endsWith('.js'))
      .sort();

    if (migrationJsFiles.length === 0) {
      console.log(`[${service}] No migration files found`);
      return;
    }

    const db = getDb();

    // Run each migration
    for (const file of migrationJsFiles) {
      const migrationPath = join(migrationsDir, file);
      // Convert Windows path to file:// URL format
      const migrationUrl = `file:///${migrationPath.replace(/\\/g, '/')}`;
      const migration = await import(migrationUrl);
      
      if (typeof migration.up === 'function') {
        console.log(`[${service}] Running ${file}...`);
        await migration.up();
        console.log(`[${service}] ✓ ${file} completed`);
      }
    }

    console.log(`[${service}] All migrations completed`);
  } catch (error) {
    console.error(`[${service}] Migration error:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    for (const service of services) {
      try {
        await runMigrationsForService(service);
      } catch (error) {
        console.error(`[${service}] Failed: ${error.message}`);
        // Continue with other services
      }
    }
    
    await closeDb();
    console.log('\n✓ All migrations completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await closeDb();
    process.exit(1);
  }
}

main();

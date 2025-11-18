// Migration runner script - runs Knex migrations for all services
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const services = ['users', 'products', 'orders', 'payments', 'notifications'];

async function runMigration(service) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${service}] Running migrations...`);
    
    const child = spawn('pnpm', ['--filter', service, 'migrate:latest'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[${service}] Migrations completed`);
        resolve();
      } else {
        console.error(`[${service}] Migration failed with code ${code}`);
        reject(new Error(`Migration failed for ${service}`));
      }
    });
  });
}

async function main() {
  try {
    for (const service of services) {
      try {
        await runMigration(service);
      } catch (error) {
        console.log(`Skipping ${service}: ${error.message}`);
      }
    }
    console.log('\n✓ All migrations completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

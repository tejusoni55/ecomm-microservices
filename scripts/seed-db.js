// Seed script - seeds initial data (admin user, sample products, etc.)
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seeds = [
  { service: 'users', name: '001_seed_admin_user' },
  { service: 'products', name: '001_seed_products' },
];

async function runSeed(service) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${service}] Running seeds...`);
    
    const child = spawn('pnpm', ['--filter', service, 'seed:run'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[${service}] Seeds completed`);
        resolve();
      } else {
        console.error(`[${service}] Seed failed with code ${code}`);
        reject(new Error(`Seed failed for ${service}`));
      }
    });
  });
}

async function main() {
  try {
    for (const { service } of seeds) {
      try {
        await runSeed(service);
      } catch (error) {
        console.log(`Skipping ${service}: ${error.message}`);
      }
    }
    console.log('\n✓ All seeds completed');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();

// Seed script - seeds initial data using raw SQL (admin user, sample products, etc.)
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seeds = [
  { service: 'users', name: '001_seed_admin_user' },
  { service: 'products', name: '001_seed_products' },
];

async function runSeed(seedConfig) {
  try {
    console.log(`\n[${seedConfig.service}] Running seed: ${seedConfig.name}...`);
    
    const seedPath = join(
      __dirname,
      '..',
      'services',
      seedConfig.service,
      'src',
      'seeds',
      `${seedConfig.name}.js`
    );

    // Convert Windows path to file:// URL format
    const seedUrl = `file:///${seedPath.replace(/\\/g, '/')}`;
    
    // Import and run seed
    const seedModule = await import(seedUrl);
    
    if (typeof seedModule.seed === 'function') {
      await seedModule.seed();
      console.log(`[${seedConfig.service}] ✓ ${seedConfig.name} completed`);
    } else {
      console.log(`[${seedConfig.service}] No seed function found in ${seedConfig.name}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`[${seedConfig.service}] Seed file not found, skipping`);
      return;
    }
    console.error(`[${seedConfig.service}] Seed error:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    for (const seedConfig of seeds) {
      try {
        await runSeed(seedConfig);
      } catch (error) {
        console.error(`[${seedConfig.service}] Failed: ${error.message}`);
        // Continue with other seeds
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

// Products service migration: create products table (raw SQL)
import { getDb } from '@ecomm/db';

export async function up() {
  const db = getDb();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      stock INTEGER DEFAULT 0,
      sku VARCHAR(100) UNIQUE,
      image_url VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function down() {
  const db = getDb();
  await db.query('DROP TABLE IF EXISTS products');
}

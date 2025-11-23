// Users service seed: create admin user (raw SQL)
import bcrypt from 'bcrypt';
import { getDb } from '../db.js';

export async function seed() {
  const db = getDb();
  
  // Delete existing entries
  await db.query('DELETE FROM users');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const testPassword = await bcrypt.hash('password123', 10);

  // Insert seed data
  await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['admin@ecomm.local', adminPassword, 'Admin', 'User', 'admin', true]
  );

  await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['test@example.com', testPassword, 'Test', 'User', 'consumer', true]
  );
}

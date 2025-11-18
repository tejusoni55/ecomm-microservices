// Payments service migration: create payments table (raw SQL)
import { getDb } from '../db.js';

export async function up() {
  const db = getDb();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      transaction_id VARCHAR(100) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
}

export async function down() {
  const db = getDb();
  await db.query('DROP TABLE IF EXISTS payments');
}


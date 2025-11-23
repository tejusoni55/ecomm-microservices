// Products service seed: sample products (raw SQL)
import { getDb } from '@ecomm/db';

export async function seed() {
  const db = getDb();
  
  // Delete existing entries
  await db.query('DELETE FROM products');

  // Insert seed data
  const products = [
    {
      name: 'Laptop Pro 15',
      description: 'High-performance laptop with 16GB RAM',
      price: 1299.99,
      stock: 10,
      sku: 'LAPTOP-001',
      status: 'active',
    },
    {
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with 2.4GHz receiver',
      price: 29.99,
      stock: 50,
      sku: 'MOUSE-001',
      status: 'active',
    },
    {
      name: 'USB-C Hub',
      description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader',
      price: 49.99,
      stock: 25,
      sku: 'HUB-001',
      status: 'active',
    },
    {
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches',
      price: 129.99,
      stock: 15,
      sku: 'KEYBOARD-001',
      status: 'active',
    },
    {
      name: 'Monitor 27 inch 4K',
      description: '27 inch 4K UHD monitor with HDR support',
      price: 399.99,
      stock: 8,
      sku: 'MONITOR-001',
      status: 'active',
    },
  ];

  for (const product of products) {
    await db.query(
      `INSERT INTO products (name, description, price, stock, sku, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [product.name, product.description, product.price, product.stock, product.sku, product.status]
    );
  }
}

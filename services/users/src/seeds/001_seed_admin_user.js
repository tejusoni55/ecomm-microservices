// Users service seed: create admin user
import bcrypt from 'bcrypt';

export async function seed(knex) {
  // Delete existing entries
  await knex('users').del();

  // Hash admin password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Insert seed data
  await knex('users').insert([
    {
      email: 'admin@ecomm.local',
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
    },
    {
      email: 'test@example.com',
      password_hash: await bcrypt.hash('password123', 10),
      first_name: 'Test',
      last_name: 'User',
      role: 'consumer',
      is_active: true,
    },
  ]);
}

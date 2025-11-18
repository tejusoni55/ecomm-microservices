// Orders service migration: create orders and order items tables
export async function up(knex) {
  // Orders table
  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.decimal('total', 10, 2).defaultTo(0);
    table.enum('status', ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).defaultTo('pending');
    table.text('notes');
    table.timestamps(true, true);
  });

  // Order items table
  return knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('product_id').notNullable();
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('subtotal', 10, 2).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('order_items');
  return knex.schema.dropTableIfExists('orders');
}

// Products service migration: create products table
export async function up(knex) {
  return knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    table.decimal('price', 10, 2).notNullable();
    table.integer('stock').defaultTo(0);
    table.string('sku', 100).unique();
    table.string('image_url', 500);
    table.enum('status', ['active', 'inactive']).defaultTo('active');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  return knex.schema.dropTableIfExists('products');
}

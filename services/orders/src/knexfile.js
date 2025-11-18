// Knex configuration for orders service
export default {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'ecomm_dev',
    },
    migrations: {
      extension: 'js',
      directory: './src/migrations',
    },
    seeds: {
      extension: 'js',
      directory: './src/seeds',
    },
  },
};

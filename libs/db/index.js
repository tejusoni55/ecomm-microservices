// Database configuration using node-postgres Pool (raw SQL usage)
import pkg from "pg";
const { Pool } = pkg;
import fs from "fs";

let pool = null;

export function getDb() {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "ecomm_dev",
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    min: parseInt(process.env.DB_POOL_MIN || "2", 10),
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false, // for self-signed cert
            ca: fs
              .readFileSync(
                process.env.DB_CA_CERT_PATH || "./postgres-certs/server.crt"
              )
              .toString(),
          }
        : false,
  });

  return pool;
}

export async function closeDb() {
  if (pool) {
    try {
      await pool.end();
    } finally {
      pool = null;
    }
  }
}

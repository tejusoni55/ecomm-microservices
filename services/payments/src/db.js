// Database module for payments service
import { getDb as getPgPool, closeDb } from '@ecomm/db';

export function getDb() {
  return getPgPool();
}

export { closeDb };


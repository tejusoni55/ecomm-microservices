// Database module for orders service
import { getDb as getPgPool, closeDb } from '@ecomm/db';

export function getDb() {
  return getPgPool();
}

export { closeDb };


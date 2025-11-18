// Database module for users service (raw pg client)
import { getDb as getPgPool, closeDb } from '@ecomm/db';

export function getDb() {
  return getPgPool();
}

export { closeDb };

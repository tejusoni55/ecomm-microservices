// Kafka producer for users service
import { publish } from '@ecomm/kafka';
import logger from './logger.js';

export async function publishUserCreated(user) {
  try {
    await publish('user.created', {
      key: String(user.id),
      value: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        created_at: user.created_at,
      },
    });
    logger.info(`Published user.created event for user ${user.id}`);
  } catch (error) {
    logger.error('Failed to publish user.created event', { error: error.message });
    throw error;
  }
}

export async function publishUserUpdated(user) {
  try {
    await publish('user.updated', {
      key: String(user.id),
      value: {
        id: user.id,
        email: user.email,
        role: user.role,
        updated_at: new Date().toISOString(),
      },
    });
    logger.info(`Published user.updated event for user ${user.id}`);
  } catch (error) {
    logger.error('Failed to publish user.updated event', { error: error.message });
  }
}

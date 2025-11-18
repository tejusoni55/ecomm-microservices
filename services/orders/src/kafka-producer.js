// Kafka producer for orders service
import { publish } from '@ecomm/kafka';
import logger from '@ecomm/logger';

export async function publishOrderCreated(order) {
  try {
    await publish('order.created', {
      key: String(order.id),
      value: {
        order_id: order.id,
        user_id: order.user_id,
        total: parseFloat(order.total),
        status: order.status,
        items: order.items || [],
        created_at: order.created_at,
      },
    });
    logger.info(`Published order.created event for order ${order.id}`);
  } catch (error) {
    logger.error('Failed to publish order.created event', { error: error.message });
    throw error;
  }
}

export async function publishOrderUpdated(order) {
  try {
    await publish('order.updated', {
      key: String(order.id),
      value: {
        order_id: order.id,
        user_id: order.user_id,
        status: order.status,
        total: parseFloat(order.total),
        updated_at: order.updated_at || new Date().toISOString(),
      },
    });
    logger.info(`Published order.updated event for order ${order.id}`);
  } catch (error) {
    logger.error('Failed to publish order.updated event', { error: error.message });
    throw error;
  }
}


// Kafka producer for products service
import { publish } from '@ecomm/kafka';
import logger from '@ecomm/logger';

export async function publishProductCreated(product) {
  try {
    await publish('product.created', {
      key: String(product.id),
      value: {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        sku: product.sku,
        stock: product.stock,
        created_at: product.created_at,
      },
    });
    logger.info(`Published product.created event for product ${product.id}`);
  } catch (error) {
    logger.error('Failed to publish product.created event', { error: error.message });
    throw error;
  }
}

export async function publishProductUpdated(product) {
  try {
    await publish('product.updated', {
      key: String(product.id),
      value: {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        stock: product.stock,
        status: product.status,
        updated_at: product.updated_at || new Date().toISOString(),
      },
    });
    logger.info(`Published product.updated event for product ${product.id}`);
  } catch (error) {
    logger.error('Failed to publish product.updated event', { error: error.message });
    throw error;
  }
}


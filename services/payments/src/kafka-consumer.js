// Kafka consumer for payments service
import { subscribe } from '@ecomm/kafka';
import logger from '@ecomm/logger';
import { processPayment } from './payment-processor.js';

// Subscribe to order.created events and process payments
export async function startOrderConsumer() {
  try {
    await subscribe('order.created', 'payments-group', async (event) => {
      try {
        const { order_id, user_id, total } = event;

        if (!order_id || !user_id || !total) {
          logger.error('Invalid order.created event', { event });
          return;
        }

        logger.info(`Received order.created event for order ${order_id}, processing payment`);

        // Process payment
        const result = await processPayment(order_id, user_id, total);

        if (result.success) {
          logger.info(`Payment processed successfully for order ${order_id}`);
        } else {
          logger.warn(`Payment failed for order ${order_id}: ${result.reason}`);
        }
      } catch (error) {
        logger.error('Error processing order.created event', { 
          error: error.message, 
          event,
          stack: error.stack 
        });
        // Don't throw - let Kafka handle retries
      }
    });

    logger.info('Kafka consumer started for order.created events');
  } catch (error) {
    logger.error('Failed to start Kafka consumer', { error: error.message });
    throw error;
  }
}


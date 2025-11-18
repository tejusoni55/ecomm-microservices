// Kafka consumers for notifications service
import { subscribe } from '@ecomm/kafka';
import logger from '@ecomm/logger';
import {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
} from './email.js';

// Start all Kafka consumers
export async function startAllConsumers() {
  try {
    // Consumer for user.created events
    await subscribe('user.created', 'notifications-group', async (event) => {
      try {
        logger.info(`Received user.created event for user ${event.id}`);
        await sendWelcomeEmail({
          email: event.email,
          first_name: event.first_name,
          last_name: event.last_name,
        });
        logger.info(`Welcome email sent to ${event.email}`);
      } catch (error) {
        logger.error('Error processing user.created event', { 
          error: error.message, 
          event,
          stack: error.stack 
        });
        // Don't throw - let Kafka handle retries
      }
    });

    // Consumer for order.created events
    await subscribe('order.created', 'notifications-group', async (event) => {
      try {
        logger.info(`Received order.created event for order ${event.order_id}`);
        
        // Note: In a real system, you'd get user email from user service via gRPC
        // For now, we'll use a placeholder or get it from the event if available
        const userEmail = event.user_email || `user-${event.user_id}@example.com`;
        
        await sendOrderConfirmationEmail(event, userEmail);
        logger.info(`Order confirmation email sent for order ${event.order_id}`);
      } catch (error) {
        logger.error('Error processing order.created event', { 
          error: error.message, 
          event,
          stack: error.stack 
        });
      }
    });

    // Consumer for payment.succeeded events
    await subscribe('payment.succeeded', 'notifications-group', async (event) => {
      try {
        logger.info(`Received payment.succeeded event for order ${event.order_id}`);
        
        // Note: In a real system, you'd get user email from user service via gRPC
        const userEmail = event.user_email || `user-${event.user_id}@example.com`;
        
        await sendPaymentSuccessEmail(event, userEmail);
        logger.info(`Payment success email sent for order ${event.order_id}`);
      } catch (error) {
        logger.error('Error processing payment.succeeded event', { 
          error: error.message, 
          event,
          stack: error.stack 
        });
      }
    });

    // Consumer for payment.failed events
    await subscribe('payment.failed', 'notifications-group', async (event) => {
      try {
        logger.info(`Received payment.failed event for order ${event.order_id}`);
        
        // Note: In a real system, you'd get user email from user service via gRPC
        const userEmail = event.user_email || `user-${event.user_id}@example.com`;
        
        await sendPaymentFailedEmail(event, userEmail);
        logger.info(`Payment failure email sent for order ${event.order_id}`);
      } catch (error) {
        logger.error('Error processing payment.failed event', { 
          error: error.message, 
          event,
          stack: error.stack 
        });
      }
    });

    logger.info('All Kafka consumers started for notifications service');
  } catch (error) {
    logger.error('Failed to start Kafka consumers', { error: error.message });
    throw error;
  }
}


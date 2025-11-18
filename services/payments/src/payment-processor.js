// Payment processor for payments service
import { getDb } from './db.js';
import logger from '@ecomm/logger';
import { publish } from '@ecomm/kafka';

const FAILURE_RATE = parseInt(process.env.PAYMENT_FAILURE_RATE || '6', 10);

// Process payment for an order
export async function processPayment(orderId, userId, amount) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Check if payment already exists (idempotency)
    const existingPayment = await client.query(
      'SELECT * FROM payments WHERE order_id = $1',
      [orderId]
    );

    if (existingPayment.rows.length > 0) {
      const payment = existingPayment.rows[0];
      logger.info(`Payment already exists for order ${orderId}, status: ${payment.status}`);
      await client.query('ROLLBACK');
      return {
        success: payment.status === 'succeeded',
        payment_id: payment.id,
        transaction_id: payment.transaction_id,
        status: payment.status,
      };
    }

    // Create payment record with pending status
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments (order_id, user_id, amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, userId, amount, 'processing']
    );

    const payment = paymentRows[0];

    // Publish payment.attempted event
    await publish('payment.attempted', {
      key: String(orderId),
      value: {
        transaction_id: null,
        order_id: orderId,
        user_id: userId,
        amount: parseFloat(amount),
        timestamp: new Date().toISOString(),
      },
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

    // Simulate payment processing with configurable failure rate
    const random = Math.floor(Math.random() * FAILURE_RATE);
    const shouldFail = random === 0; // 1 in FAILURE_RATE chance of failure

    const transactionId = `TXN-${Date.now()}-${orderId}`;

    if (shouldFail) {
      const failureReason = 'Simulated payment failure';
      
      // Update payment record
      await client.query(
        `UPDATE payments 
         SET status = $1, failure_reason = $2, transaction_id = $3, updated_at = NOW()
         WHERE id = $4`,
        ['failed', failureReason, transactionId, payment.id]
      );

      await client.query('COMMIT');

      // Publish payment.failed event
      await publish('payment.failed', {
        key: String(orderId),
        value: {
          transaction_id: transactionId,
          order_id: orderId,
          user_id: userId,
          amount: parseFloat(amount),
          reason: failureReason,
          timestamp: new Date().toISOString(),
        },
      });

      logger.warn(`Payment failed for order ${orderId}`);
      return {
        success: false,
        payment_id: payment.id,
        transaction_id: transactionId,
        status: 'failed',
        reason: failureReason,
      };
    }

    // Payment succeeded
    await client.query(
      `UPDATE payments 
       SET status = $1, transaction_id = $2, updated_at = NOW()
       WHERE id = $3`,
      ['succeeded', transactionId, payment.id]
    );

    await client.query('COMMIT');

    // Publish payment.succeeded event
    await publish('payment.succeeded', {
      key: String(orderId),
      value: {
        transaction_id: transactionId,
        order_id: orderId,
        user_id: userId,
        amount: parseFloat(amount),
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Payment succeeded for order ${orderId}, transaction: ${transactionId}`);
    return {
      success: true,
      payment_id: payment.id,
      transaction_id: transactionId,
      status: 'succeeded',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing payment', { error: error.message, orderId });
    throw error;
  } finally {
    client.release();
  }
}

// Get payment status
export async function getPaymentStatus(transactionId) {
  const db = getDb();
  const { rows } = await db.query(
    'SELECT * FROM payments WHERE transaction_id = $1',
    [transactionId]
  );

  if (rows.length === 0) {
    return null;
  }

  const payment = rows[0];
  return {
    id: payment.id,
    order_id: payment.order_id,
    user_id: payment.user_id,
    amount: parseFloat(payment.amount),
    transaction_id: payment.transaction_id,
    status: payment.status,
    failure_reason: payment.failure_reason,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}


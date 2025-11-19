// Payments service main Express server with Kafka consumer
import 'dotenv/config';
import express from 'express';
import logger from '@ecomm/logger';
import { getDb, closeDb } from './db.js';
import { processPayment, getPaymentStatus } from './payment-processor.js';
import { startOrderConsumer } from './kafka-consumer.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 8004;

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payments', timestamp: new Date().toISOString() });
});

// Ready check endpoint (checks database)
app.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.query('SELECT 1');
    res.json({ status: 'ready', service: 'payments' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// REST endpoint to process payment manually
app.post('/process-payment', async (req, res) => {
  try {
    const { order_id, user_id, amount } = req.body;

    if (!order_id || !user_id || !amount) {
      return res.status(400).json({ error: 'order_id, user_id, and amount are required' });
    }

    const result = await processPayment(order_id, user_id, amount);

    res.json({
      order_id,
      amount,
      success: result.success,
      payment_id: result.payment_id,
      transaction_id: result.transaction_id,
      status: result.status,
      message: result.success ? 'Payment processed successfully' : `Payment failed: ${result.reason}`,
    });
  } catch (error) {
    logger.error('Error processing payment', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status/:transactionId - Get payment status
app.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const payment = await getPaymentStatus(transactionId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      payment,
    });
  } catch (error) {
    logger.error('Error getting payment status', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start HTTP server
const server = app.listen(PORT, async () => {
  logger.info(`Payments service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start Kafka consumer
  try {
    await startOrderConsumer();
  } catch (error) {
    logger.error('Failed to start Kafka consumer', { error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });
});

export default app;

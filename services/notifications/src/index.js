// Notifications service main Express server with Kafka consumer
import 'dotenv/config';
import express from 'express';
import logger from '@ecomm/logger';
import {
  getQueuedNotifications,
  clearQueue,
} from './email.js';
import { startAllConsumers } from './kafka-consumers.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 8005;

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notifications', timestamp: new Date().toISOString() });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  // Notifications service doesn't have a database, so it's always ready
  res.json({ status: 'ready', service: 'notifications' });
});

// Get queued notifications (for dev/debugging)
app.get('/queued', (req, res) => {
  res.json({ notifications: getQueuedNotifications() });
});

// Clear notification queue (for dev/debugging)
app.post('/clear-queue', (req, res) => {
  clearQueue();
  res.json({ message: 'Queue cleared' });
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
  logger.info(`Notifications service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Maildev Web UI: http://localhost:1080');
  
  // Start Kafka consumers
  try {
    await startAllConsumers();
  } catch (error) {
    logger.error('Failed to start Kafka consumers', { error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;

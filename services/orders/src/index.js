// Orders service main Express server
import 'dotenv/config';
import express from 'express';
import logger from '@ecomm/logger';
import { getDb, closeDb } from './db.js';
import ordersRouter from './routes/orders.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 3003;

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders', timestamp: new Date().toISOString() });
});

// Ready check endpoint (checks database)
app.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.query('SELECT 1');
    res.json({ status: 'ready', service: 'orders' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Routes
app.use('/orders', ordersRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Orders service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
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

export default app;

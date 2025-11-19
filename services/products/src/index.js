// Products service main Express server
import 'dotenv/config';
import express from 'express';
import logger from '@ecomm/logger';
import { getDb, closeDb } from '@ecomm/db';
import productsRouter from './routes/products.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 8002;

app.use(express.json());
// Express middleware
import { rateLimitMiddleware } from "@ecomm/redis/middleware";
app.use(rateLimitMiddleware({ maxRequests: 100, windowSeconds: 60 }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'products' });
});

// Ready check endpoint (checks database)
app.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.query('SELECT 1');
    res.json({ status: 'ready', service: 'products' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

app.use('/products', productsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  logger.info(`Products service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

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

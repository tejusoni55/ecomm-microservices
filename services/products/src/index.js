// Products service main Express server
import 'dotenv/config';
import express from 'express';
import logger from '@ecomm/logger';
import { getDb, closeDb } from '@ecomm/db';
import productsRouter from './routes/products.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 3002;

app.use(express.json());

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

const server = app.listen(PORT, () => {
  logger.info(`Products service started on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });
});

export default app;

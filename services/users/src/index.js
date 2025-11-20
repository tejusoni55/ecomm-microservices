// Users service main Express server
import 'dotenv/config';
import express from 'express';
import logger from './logger.js';
import { getDb, closeDb } from './db.js';
import authRoutes from './routes/auth.js';
import { startGrpcServer, stopGrpcServer } from './grpc-server.js';

const app = express();
const PORT = process.env.SERVICE_PORT || 8001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'users', timestamp: new Date().toISOString() });
});

// Ready check endpoint (checks database)
app.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.query('SELECT 1');
    res.json({ status: 'ready', service: 'users' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Routes
app.use('/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  logger.info(`Users service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Start gRPC server
const GRPC_PORT = parseInt(process.env.GRPC_PORT || '50051', 10);
try {
  startGrpcServer(GRPC_PORT);
} catch (error) {
  logger.error('Failed to start gRPC server', { error: error.message });
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopGrpcServer();
  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopGrpcServer();
  server.close(() => {
    logger.info('HTTP server closed');
    closeDb();
    process.exit(0);
  });
});

export default app;

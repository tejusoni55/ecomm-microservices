// Logger library: Winston-based structured logging with OpenTelemetry support
// Sends logs to OpenTelemetry Collector via OTLP for BetterStack ingestion
import winston from 'winston';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { getLoggerProvider, LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry Logger Provider
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'ecomm-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});

const loggerProvider = new LoggerProvider({ resource });

// Configure OTLP exporter to send logs to BetterStack via Collector
const otlpExporter = new OTLPLogExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/logs',
});

loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(otlpExporter));

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp.slice(0, 19).replace('T', ' ');
    return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
  })
);

const transports = [
  new winston.transports.Console(),
];

// Add file transport in production for local backup
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/all.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

// Graceful shutdown: flush pending logs to BetterStack
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, flushing logs to BetterStack');
  await loggerProvider.shutdown();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, flushing logs to BetterStack');
  await loggerProvider.shutdown();
});

export default logger;
export { loggerProvider };

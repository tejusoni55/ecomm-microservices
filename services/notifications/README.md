# Notifications Microservice

Email notifications service that consumes Kafka events and sends emails via SMTP.

## Overview

The Notifications service listens to Kafka events from across the system and sends appropriate emails:
- User signup notifications
- Product-related alerts
- Order confirmations and status updates
- Payment notifications

## Environment Variables

```bash
# Service configuration
NOTIFICATIONS_PORT=3005
NODE_ENV=development
LOG_LEVEL=debug

# Kafka configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=notifications

# Email configuration
MAILDEV_HOST=localhost
MAILDEV_PORT=1025

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc

# BetterStack
BETTERSTACK_LOGS_TOKEN=your-token-here
```

## Running Locally

```bash
# Development mode (with auto-reload)
pnpm dev

# Production mode
pnpm start

# Run tests
pnpm test
```

## Kafka Consumers

The service subscribes to these Kafka topics:

- `user.created` - Sends welcome email to new users
- `user.updated` - Notifies user of profile changes
- `product.created` - Notifies subscribers of new products
- `product.updated` - Alerts on product changes
- `order.created` - Sends order confirmation
- `order.updated` - Sends order status updates
- `payment.succeeded` - Sends payment confirmation
- `payment.failed` - Alerts user to payment failure

## API Endpoints

### Health Check
```bash
GET /health
```

Returns 200 if service is running.

### Ready Check
```bash
GET /ready
```

Returns 200 if service is ready (database/kafka connected).

## Email Templates

Email templates would typically be stored in a `templates/` directory:
- `welcome.html` - Welcome email for new users
- `order-confirmation.html` - Order confirmation
- `order-status.html` - Order status updates
- `product-notification.html` - Product alerts
- `payment-confirmation.html` - Payment confirmations
- `payment-error.html` - Payment failure notifications

## Testing in Development

Use Maildev UI to view sent emails:
- URL: `http://localhost:1080`
- No authentication required
- View both HTML and plain text emails

## Deployment

### Docker Build
```bash
docker build -t notifications:latest .
```

### Docker Run
```bash
docker run -p 3005:3005 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e MAILDEV_HOST=maildev \
  notifications:latest
```

## Architecture

```
Kafka Topics
     ↓
Kafka Consumer
     ↓
Email Template Processing
     ↓
SMTP (Maildev in dev, SendGrid/AWS SES in prod)
     ↓
User Email
```

## Monitoring

Logs are sent to BetterStack via OpenTelemetry:
- Service startup/shutdown
- Kafka consumer group status
- Email sending events
- Errors and failures

## Next Steps

Phase 2 implementation should include:
- [ ] Email template system
- [ ] Kafka consumer implementation
- [ ] Email sending logic with retry
- [ ] Template interpolation
- [ ] Unsubscribe handling
- [ ] Email tracking
- [ ] Rate limiting

See [CHECKLIST.md](../../CHECKLIST.md) for Phase 2 requirements.

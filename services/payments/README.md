# Payments Service

Simulated payment processing service with configurable failure rates for testing retry logic.

## Service Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /process-payment | Process a payment |
| GET | /health | Health check |

## Features

- Simulated payment processing (1 in N attempts fail, configurable)
- Publishes `payment.succeeded` and `payment.failed` events to Kafka
- Example latency simulation (0.5-2 seconds)

## Configuration

Set `PAYMENT_FAILURE_RATE` to control failure simulation:
- `6` = 1 in 6 attempts fail (16.7% failure rate)
- `10` = 1 in 10 attempts fail (10% failure rate)
- `3` = 1 in 3 attempts fail (33.3% failure rate)

## Running

```bash
pnpm --filter payments dev
```

**What's Next**: Add Kafka consumer for order.created events and implement payment flow.

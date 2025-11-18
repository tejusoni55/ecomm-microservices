# Orders Service

Order management service with order creation, tracking, and event publishing.

## Service Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /orders | Create new order | JWT |
| GET | /health | Health check | No |

## Running

```bash
pnpm --filter orders dev
```

**What's Next**: Implement full order creation with database storage, gRPC calls to users service, and payment integration.

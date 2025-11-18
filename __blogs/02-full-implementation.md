---
title: Building Microservices with Node.js: Part 2 - Full Implementation of All Services
description: Implement Products, Orders, Payments, and Notifications services with Kafka integration and gRPC
tags: nodejs, microservices, kafka, grpc, event-driven
reading_time: 15 min
---

# Building Microservices with Node.js: Part 2 - Full Implementation of All Services

## Short Summary

In Part 1, we set up the foundational infrastructure and implemented the Users service. Now we'll complete the e-commerce platform by implementing the remaining four services and connecting them through Kafka events and gRPC calls.

You'll learn how to:
- Build the Products service with image upload support
- Create the Orders service with order lifecycle management
- Simulate payments in the Payments service
- Send emails via the Notifications service using event-driven patterns
- Call services synchronously using gRPC
- Write integration tests for event flows

---

## Prerequisites

- Completed Part 1 of this series
- Docker Compose running with all infrastructure
- Users service fully implemented and tested
- Understanding of Kafka topics and events

## Estimated Reading Time: 15 minutes
## Estimated Coding Time: 60-90 minutes

---

## Section 1: Kafka Event-Driven Architecture

### Event Flow Diagram

[IMAGE: Sequence diagram showing event flow between services]

Services communicate in two ways:

**Synchronous (gRPC):**
- Orders → Users (get user details)
- Orders → Payments (sync payment status)

**Asynchronous (Kafka Events):**
- Users → Kafka: `user.created`
- Products → Kafka: `product.created`, `product.updated`
- Orders → Kafka: `order.created`, `order.updated`
- Payments → Kafka: `payment.attempted`, `payment.succeeded`, `payment.failed`
- Notifications: Listens to all above topics

### Canonical Kafka Topics

Define these topics in your Kafka cluster:
- `user.created` - New user signup
- `product.created` - New product added
- `product.updated` - Product information changed
- `order.created` - New order placed
- `order.updated` - Order status changed
- `payment.attempted` - Payment attempt started
- `payment.succeeded` - Payment completed successfully
- `payment.failed` - Payment failed
- `notification.email` - Email to send (from Notifications service)

---

## Section 2: Products Service

### Step 1: Products Service Structure

[INSERT: services/products/src/index.js]

Endpoints:
- `GET /list` - List all products with pagination and filtering
- `GET /:id` - Get single product details
- `POST /` - Create product (admin only)
- `PUT /:id` - Update product (admin only)
- `POST /:id/image` - Upload product image

### Step 2: Database Migration

[INSERT: services/products/src/migrations/001_create_products_table.js]

Schema:
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(50) UNIQUE,
  image_url VARCHAR(500),
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_sku ON products(sku);
```

### Step 3: Kafka Producer

[INSERT: services/products/src/kafka-producer.js]

Publishes events when:
- Product created
- Product updated
- Stock changed

### Step 4: Test Products Service

```bash
# Start products service
pnpm --filter products dev

# List products
curl http://localhost:3002/list

# Create product (requires auth token from users service)
curl -X POST http://localhost:3002/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": 999.99,
    "stock_quantity": 50,
    "sku": "LAPTOP-001"
  }'
```

---

## Section 3: Orders Service

### Step 5: Orders Service Implementation

[INSERT: services/orders/src/index.js]

Endpoints:
- `POST /create` - Create new order (authenticated)
- `GET /:id` - Get order details
- `GET /user/:userId` - List user's orders
- `PUT /:id/status` - Update order status

### Step 6: Order Lifecycle

```
user submits order
    ↓
Orders service validates & stores in DB
    ↓
Publishes 'order.created' event
    ↓
Payments service listens & charges
    ↓
Publishes 'payment.succeeded' or 'payment.failed'
    ↓
Orders service updates order status
    ↓
Notifications service sends confirmation email
```

### Step 7: gRPC Call to Users Service

[INSERT: services/orders/src/grpc/user-client.js]

Usage:
```javascript
const userDetails = await getUserDetails(userId);
```

Proto definition:
```protobuf
service UserService {
  rpc GetUser (GetUserRequest) returns (GetUserResponse);
}
```

### Step 8: Database Migration

[INSERT: services/orders/src/migrations/001_create_orders_table.js]

Schema:
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  items_count INTEGER,
  shipping_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
```

### Step 9: Test Orders Flow

```bash
# Start orders service
pnpm --filter orders dev

# Create order (with valid JWT)
curl -X POST http://localhost:3003/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "product_id": 1,
        "quantity": 2,
        "price": 99.99
      }
    ],
    "shipping_address": "123 Main St"
  }'

# Check order status in Kafka
docker compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic order.created \
  --from-beginning
```

---

## Section 4: Payments Service

### Step 10: Payments Service

[INSERT: services/payments/src/index.js]

Endpoints:
- `POST /process` - Process payment (via REST)
- `GET /status/:transactionId` - Check payment status
- `GET /health` - Health check

### Step 11: Simulated Payment Logic

[INSERT: services/payments/src/payment-processor.js]

Features:
- Simulates 1-in-6 random failures
- Configurable via `PAYMENT_FAILURE_RATE` env var
- Adds realistic latency (100-500ms)
- Publishes success/failure events to Kafka

Example configuration:
```bash
# Make 20% of payments fail
PAYMENT_FAILURE_RATE=0.2
```

### Step 12: Kafka Consumer for Order Events

```javascript
// Subscribe to order.created events
subscribe('order.created', 'payments-group', async (event) => {
  // Process payment
  const result = await processPayment(event.user_id, event.amount);
  
  // Publish result
  if (result.success) {
    await publish('payment.succeeded', { ... });
  } else {
    await publish('payment.failed', { ... });
  }
});
```

### Step 13: Database Migration

[INSERT: services/payments/src/migrations/001_create_payments_table.js]

Schema:
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
```

---

## Section 5: Notifications Service

### Step 14: Notifications Service

[INSERT: services/notifications/src/index.js]

Features:
- Consumes events from Kafka topics
- Sends emails via Maildev SMTP
- Queues notifications for local testing
- Exposes API to view queued emails

### Step 15: Email Templates

[INSERT: services/notifications/src/email.js]

Templates:
- Welcome email (on user.created)
- Order confirmation (on order.created)
- Payment successful (on payment.succeeded)
- Payment failed (on payment.failed)

Example:
```javascript
async function sendWelcomeEmail(user) {
  const html = `
    <h1>Welcome ${user.first_name}!</h1>
    <p>Your account has been created. Login with ${user.email}</p>
    <a href="https://ecomm.local/login">Go to app</a>
  `;
  
  await sendEmail(user.email, 'Welcome!', html);
}
```

### Step 16: Test Notifications

```bash
# Start notifications service
pnpm --filter notifications dev

# View queued notifications
curl http://localhost:3005/queued

# View in Maildev web UI
open http://localhost:1080
```

---

## Section 6: Synchronous Service Calls with gRPC

### Step 17: Define gRPC Services

[INSERT: libs/grpc-protos/users.proto]

### Step 18: Generate gRPC Stubs

```bash
# Install gRPC tools (if not already done)
npm install --save-dev @grpc/grpc-js @grpc/proto-loader

# Generate stubs from proto files
# This is typically done in a build step or manually
```

### Step 19: Implement gRPC Server (Users Service)

[INSERT: services/users/src/grpc/server.js]

```javascript
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('libs/grpc-protos/users.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition);

function getUser(call, callback) {
  const userId = call.request.user_id;
  // Query database
  const user = db('users').where('id', userId).first();
  callback(null, user);
}

const server = new grpc.Server();
server.addService(userProto.ecomm.users.UserService.service, {
  GetUser: getUser,
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
  logger.info('gRPC server started on port 50051');
});
```

### Step 20: Implement gRPC Client (Orders Service)

[INSERT: services/orders/src/grpc/user-client.js]

```javascript
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('libs/grpc-protos/users.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition);
const client = new userProto.ecomm.users.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

export async function getUserDetails(userId) {
  return new Promise((resolve, reject) => {
    client.GetUser({ user_id: userId }, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}
```

---

## Section 7: Integration Testing

### Step 21: Create Integration Tests

[INSERT: services/users/src/tests/auth.test.js]

Example:
```javascript
import request from 'supertest';
import app from '../index.js';

describe('Authentication', () => {
  test('POST /auth/signup should create user', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'new@example.com',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
  });
});
```

### Step 22: Run Tests

```bash
pnpm test

# Watch mode
pnpm test:watch

# Single service
pnpm --filter users test
```

---

## Section 8: End-to-End Flow Testing

### Step 23: Complete Flow Test

```bash
# 1. Start all services
pnpm dev

# 2. In another terminal, run this sequence:

# Create new user
USER_RESPONSE=$(curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "pass123456"
  }')

TOKEN=$(echo $USER_RESPONSE | jq -r '.token')
USER_ID=$(echo $USER_RESPONSE | jq -r '.userId')

# Create order
ORDER_RESPONSE=$(curl -X POST http://localhost:3003/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id": 1, "quantity": 1}]
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.id')

# Check Kafka topics
docker compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic order.created --from-beginning

# View email in Maildev
open http://localhost:1080
```

---

## Section 9: Monitoring & Observability

### Step 24: View Traces with OpenTelemetry

Services are instrumented to send traces. To view:

1. Traces are sent to OTEL Collector on port 4317
2. Collector exports to console (for development)
3. Later: integrate with Jaeger, DataDog, New Relic, etc.

Check logs:
```bash
docker compose logs -f otel-collector
```

### Step 25: Performance Monitoring

[INSERT: tests/k6/smoke.js]

Sample K6 script for load testing:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up
    { duration: '1m30s', target: 20 }, // Stay
    { duration: '20s', target: 0 },    // Ramp down
  ],
};

export default function () {
  // List products
  let res = http.get('http://localhost:3002/list');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

Run:
```bash
k6 run tests/k6/smoke.js
```

---

## Section 10: Troubleshooting Multi-Service Issues

### Debugging Message Flow

**Check if message was published:**
```bash
docker compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic user.created \
  --from-beginning
```

**Check consumer lag:**
```bash
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group notifications-group \
  --describe
```

**Restart Kafka if topics become stuck:**
```bash
docker compose restart kafka

# Recreate topic
docker compose exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --delete --topic user.created

docker compose exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic user.created --partitions 1 --replication-factor 1
```

### gRPC Debugging

**Check if gRPC server is running:**
```bash
# From orders service
curl -X POST http://localhost:50051 -v

# Should see gRPC protocol error (expected)
```

**Enable gRPC debugging:**
```bash
GRPC_VERBOSITY=DEBUG pnpm --filter orders dev
```

---

## Section 11: Common Patterns & Best Practices

### Idempotency in Event Handlers

```javascript
// Don't do this - sends duplicate emails if handler retries
subscribe('user.created', async (event) => {
  await sendEmail(event.email);
});

// Do this - idempotent operation
subscribe('user.created', async (event) => {
  const emailSent = await db('notification_logs')
    .where('event_id', event.id)
    .first();
  
  if (emailSent) return; // Already processed
  
  await sendEmail(event.email);
  await db('notification_logs').insert({ event_id: event.id });
});
```

### Timeout Handling

```javascript
// Set timeouts for gRPC calls
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
};

const user = await withTimeout(getUserDetails(userId), 5000);
```

### Circuit Breaker Pattern

```javascript
let failureCount = 0;
const FAILURE_THRESHOLD = 5;
const RESET_TIME = 60000; // 1 minute

async function callPaymentService(data) {
  if (failureCount >= FAILURE_THRESHOLD) {
    throw new Error('Circuit breaker open');
  }
  
  try {
    const result = await makePaymentCall(data);
    failureCount = 0;
    return result;
  } catch (error) {
    failureCount++;
    if (failureCount >= FAILURE_THRESHOLD) {
      setTimeout(() => { failureCount = 0; }, RESET_TIME);
    }
    throw error;
  }
}
```

---

## What's Next?

In **Part 3**, we'll:
1. Write production-ready Dockerfiles for each service
2. Set up GitHub Actions for CI/CD
3. Create AWS deployment resources (ECS, ECR, RDS)
4. Implement automated testing in pipeline
5. Set up environment-specific configurations

---

## Key Takeaways

✓ Built complete products, orders, payments, and notifications services
✓ Implemented asynchronous communication with Kafka
✓ Added synchronous gRPC calls between services
✓ Created integration tests for multi-service flows
✓ Set up OpenTelemetry instrumentation
✓ Learned resilience patterns and debugging techniques

---

## Full Testing Checklist

- [ ] All services start without errors
- [ ] User signup/login works end-to-end
- [ ] Product listing returns products
- [ ] Can create order with authenticated user
- [ ] Kafka topics receive events
- [ ] Maildev shows notification emails
- [ ] gRPC calls succeed
- [ ] All tests pass: `pnpm test`
- [ ] Health checks respond: `/health` endpoints
- [ ] No database errors in logs

---

**Next Article**: [Part 3 - Dockerization, CI/CD, and AWS Deployment](03-deploy-ci-cd-aws.md)

**Previous Article**: [Part 1 - Design, Setup & Local Development](01-design-setup-intro.md)

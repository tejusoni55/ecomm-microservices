---
title: Building Microservices with Node.js: Part 1 - Design, Setup & Local Development
description: Learn how to set up a production-ready microservices monorepo with Node.js, Express, PostgreSQL, and Docker
tags: nodejs, microservices, docker, postgresql, devops
reading_time: 12 min
---

# Building Microservices with Node.js: Part 1 - Design, Setup & Local Development

## Short Summary

In this first post of our "Microservices End To End With Node.js" series, we'll build the foundation of a production-ready e-commerce microservices platform. We'll set up a pnpm monorepo with five services (Users, Products, Orders, Payments, Notifications), configure PostgreSQL and Kafka for local development using Docker Compose, and establish the development workflow.

By the end of this post, you'll have a fully functional local development environment where you can develop and test multiple services simultaneously.

## Prerequisites

- Node.js 18+ and pnpm 8+
- Docker and Docker Compose installed
- Basic understanding of Node.js, Express, and REST APIs
- Familiarity with Git
- A code editor (VS Code recommended)

## Estimated Reading Time: 12 minutes
## Estimated Coding Time: 30-45 minutes

---

## What We're Building

**E-Commerce Microservices Platform** with:
- **Users Service**: Authentication, signup/login, JWT tokens
- **Products Service**: Product catalog, listing, filtering
- **Orders Service**: Order management, orchestration
- **Payments Service**: Payment simulation, event handling
- **Notifications Service**: Email notifications via Kafka events

### Tech Stack
- Runtime: Node.js 18+
- Framework: Express.js
- Database: PostgreSQL
- Cache: Redis
- Message Queue: Kafka + Zookeeper
- Monorepo: pnpm workspaces
- Migrations: Knex.js
- Logging: Winston + OpenTelemetry
- API Gateway: Envoy
- Containers: Docker & Docker Compose

---

## Section 1: Understanding the Architecture

### Why Microservices?

Microservices architecture provides several benefits:
- **Independent Scaling**: Scale services based on actual demand
- **Technology Diversity**: Use different tools for different services
- **Team Autonomy**: Different teams can work on different services
- **Resilience**: Failure in one service doesn't crash the entire system
- **Deployment Flexibility**: Deploy services independently

### Our Architecture Diagram

[IMAGE: High-level architecture diagram showing 5 services, databases, Kafka, Redis, and Envoy gateway]

### Design Decisions

#### Why Knex.js instead of raw SQL?
- Provides database abstraction layer
- Type-safe migrations with version control
- Easier rollback and forward migrations
- Consistent across all services
- Great tooling for seeding

#### Why Kafka instead of direct HTTP calls?
- Decouples services
- Enables event-driven patterns
- Built-in message persistence
- Supports multiple consumers
- Easy to add new event handlers later

#### Why Envoy as API Gateway?
- Single entry point for all services
- Request routing based on paths
- Load balancing
- Observable and extensible
- Cloud-ready (used in service meshes)

---

## Section 2: Project Setup

### Step 1: Initialize the monorepo

[COMMAND]
```bash
# Create project directory
mkdir ecomm-microservices && cd ecomm-microservices

# Initialize pnpm workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'services/*'
  - 'libs/*'
  - 'scripts'
EOF
```

### Step 2: Create root package.json

[INSERT: /package.json - show scripts section]

Key scripts:
- `pnpm dev` - Start all services concurrently
- `pnpm dev:users` - Start only users service
- `docker:up` / `docker:down` - Manage Docker Compose
- `migrate:all` - Run database migrations
- `seed:all` - Seed initial data

### Step 3: Install dependencies

```bash
pnpm install
```

This installs:
- **concurrently**: Run multiple services at once
- **nodemon**: Auto-reload during development
- **dotenv**: Environment variable management

---

## Section 3: Docker Compose Setup

### Understanding Services in Compose

[INSERT: docker-compose.yml - explain each service]

The Docker Compose file includes:

**Databases & Caches:**
- PostgreSQL 15 (main database)
- Redis 7 (caching layer)

**Message Queue:**
- Zookeeper (Kafka coordination)
- Kafka (event streaming)

**Infrastructure:**
- Maildev (local SMTP + web UI for email testing)
- OpenTelemetry Collector (metrics and tracing)
- Envoy Proxy (API Gateway)

### Step 4: Start infrastructure

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f kafka  # Follow Kafka logs
```

### Verifying Services

[IMAGE: Docker Desktop showing all 8 containers running]

Health checks:
```bash
# PostgreSQL
docker compose exec postgres psql -U postgres -d ecomm_dev -c "SELECT 1"

# Kafka
docker compose exec kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Redis
docker compose exec redis redis-cli ping

# Maildev
curl http://localhost:1080/api/emails
```

---

## Section 4: Project Structure

### Directory Layout

```
ecomm-microservices/
├── services/                    # Microservices
│   ├── users/                   # Auth service
│   │   ├── src/
│   │   │   ├── index.js        # Express server
│   │   │   ├── routes/
│   │   │   │   └── auth.js     # Signup/login/verify
│   │   │   ├── migrations/     # DB migrations
│   │   │   ├── seeds/          # DB seeds
│   │   │   ├── db.js           # Database connection
│   │   │   └── kafka-producer.js
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── Dockerfile
│   ├── products/
│   ├── orders/
│   ├── payments/
│   └── notifications/
│
├── libs/                        # Shared libraries
│   ├── logger/                  # Winston + OTEL
│   ├── db/                      # Knex wrapper
│   ├── kafka/                   # Kafkajs wrapper
│   └── grpc-protos/            # gRPC definitions
│
├── scripts/                     # Helper scripts
│   ├── run-migrations.js
│   └── seed-db.js
│
├── infra/                       # Infrastructure configs
│   ├── envoy/
│   │   └── envoy.yaml          # API gateway config
│   └── otel-collector/
│       └── config.yaml          # Tracing config
│
├── __blogs/                     # Blog series drafts
│   ├── 01-design-setup-intro.md
│   └── ...
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Section 5: Shared Libraries

### The libs/ Pattern

Shared libraries help avoid duplication and ensure consistency:

#### @ecomm/logger

[INSERT: libs/logger/index.js - Winston configuration]

Usage:
```javascript
import logger from '@ecomm/logger';

logger.info('User created', { userId: 123 });
logger.error('Database error', { error: err.message });
```

Features:
- Structured JSON logging
- Different log levels (error, warn, info, debug)
- Color output in development
- File output in production

#### @ecomm/db

[INSERT: libs/db/index.js - Knex wrapper]

Usage:
```javascript
import { getKnex, closeDb } from '@ecomm/db';

const db = getKnex();
const users = await db('users').select();
```

Features:
- Single Knex instance per process
- Reads from environment variables
- Connection pooling
- Easy migration management

#### @ecomm/kafka

[INSERT: libs/kafka/index.js - Kafkajs wrapper]

Usage:
```javascript
import { publish, subscribe } from '@ecomm/kafka';

// Publish event
await publish('user.created', { key: '123', value: { id: 123, email: '...' } });

// Subscribe to events
const consumer = await subscribe('user.created', 'my-group', async (event) => {
  console.log('User created:', event);
});
```

---

## Section 6: The Users Service - Getting Started

### Why Users First?

The Users service is foundational because:
- Most other services depend on user data
- Demonstrates authentication patterns
- Shows complete service lifecycle
- Introduces database migrations

### Service Structure

[INSERT: services/users/src/index.js - main Express app]

Endpoints implemented:
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Authenticate user
- `POST /auth/verify` - Verify JWT token
- `GET /health` - Health check
- `GET /ready` - Readiness check

### Database Setup

### Step 6: Run migrations

```bash
pnpm --filter users migrate:latest
```

[INSERT: services/users/src/migrations/001_create_users_table.js]

This creates:
- `users` table with columns: id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
- Indexes on email for fast lookups

### Step 7: Seed admin user

```bash
pnpm --filter users seed:run
```

[INSERT: services/users/src/seeds/001_seed_admin_user.js]

Creates:
- Admin user: `admin@ecomm.local` / `admin123`
- Test user: `test@example.com` / `password123`

### Environment Variables

Create `.env` file in `services/users/`:

```bash
cp services/users/.env.example services/users/.env
```

[INSERT: services/users/.env.example]

---

## Section 7: Running Your First Service

### Step 8: Start the Users Service

```bash
# In one terminal
pnpm --filter users dev
```

Expected output:
```
Users service listening on port 3001
✓ Database connection established
```

### Testing Signup Endpoint

**Request:**
```bash
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepass123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

**Expected Response:**
```json
{
  "message": "User created successfully",
  "userId": 3,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 3,
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "consumer"
  }
}
```

### Testing Login Endpoint

**Request:**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepass123"
  }'
```

### Testing Authentication Middleware

Services can verify tokens by calling:
```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Section 8: Running All Services

### Step 9: Start all services concurrently

```bash
# Terminal 1: Start all services
pnpm dev

# Or start individual services in separate terminals:
pnpm dev:users      # Terminal 1
pnpm dev:products   # Terminal 2
pnpm dev:orders     # Terminal 3
pnpm dev:payments   # Terminal 4
pnpm dev:notifications # Terminal 5
```

### Envoy API Gateway

All services are accessible through Envoy on `localhost:8000`:

```bash
# Users endpoints through gateway
curl http://localhost:8000/api/users/auth/signup ...

# Products endpoints through gateway
curl http://localhost:8000/api/products/list ...

# Orders endpoints through gateway
curl http://localhost:8000/api/orders/create ...
```

---

## Section 9: Monitoring & Debugging

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f kafka

# Follow only errors
docker compose logs -f --tail=100 postgres
```

### Database Access

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d ecomm_dev

# List tables
\dt

# Query users
SELECT * FROM users;
```

### Kafka Monitoring

```bash
# List topics
docker compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# View messages in topic
docker compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic user.created \
  --from-beginning
```

### Email Testing

Open browser to: http://localhost:1080

Shows all emails sent during development.

---

## Section 10: Troubleshooting

### Common Issues

**Issue: "Cannot connect to database"**
```bash
# Check if PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Restart service
docker compose restart postgres
```

**Issue: "Kafka not available"**
```bash
# Verify Zookeeper is running first
docker compose ps | grep zookeeper

# Wait 30 seconds for Kafka to start (it depends on Zookeeper)
sleep 30

# Check Kafka health
docker compose exec kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

**Issue: "Port already in use"**
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
SERVICE_PORT=3002
```

---

## Section 11: What's Next?

In **Part 2** of this series, we'll:
1. Implement complete Products service with image upload
2. Build Orders service with order creation flow
3. Create Payments service with simulated payment processing
4. Implement Notifications service with Kafka event consumption
5. Set up gRPC for synchronous service-to-service communication
6. Add comprehensive unit and integration tests with Jest

### Advance Preparation
- Get familiar with Kafka topics and message structure
- Review gRPC basics
- Understand JWT token expiration and refresh strategies

---

## Key Takeaways

✓ Set up a pnpm monorepo for managing multiple services
✓ Configured local development with Docker Compose
✓ Created shared libraries for logger, database, and Kafka
✓ Implemented complete Users service with authentication
✓ Established health checks and readiness probes
✓ Created database migrations and seeding strategy
✓ Set up Envoy as API Gateway

---

## Summary of Commands

```bash
# Clone and setup
git clone <repo>
cd ecomm-microservices
pnpm install

# Start infrastructure
docker compose up -d

# Run migrations and seeds
pnpm run migrate:all
pnpm run seed:all

# Start development
pnpm --filter users dev

# In another terminal, test endpoints
curl -X POST http://localhost:3001/auth/signup ...
```

---

## Resources

- [Express.js Documentation](https://expressjs.com)
- [Knex.js Documentation](https://knexjs.org)
- [Kafkajs Documentation](https://kafka.js.org)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Repository Source Code](https://github.com/your-username/ecomm-microservices)

**Next Article**: [Part 2 - Full Implementation of All Services](02-full-implementation.md)

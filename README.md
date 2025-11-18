# Ecomm-Microservices

⚠️ **Internal Practice Project** - This is an educational learning project for exploring microservices architecture. External contributions are not accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

This project is designed as a **learning platform** and foundation for exploring microservices patterns and architecture.

## 📦 Services

| Service | Purpose | Port | Key Technologies |
|---------|---------|------|-------------------|
| **Users** | Authentication, JWT, user management | 3001 | Express, bcrypt, JWT |
| **Products** | Product catalog, listing, filtering | 3002 | Express, Image upload |
| **Orders** | Order management, order lifecycle | 3003 | Express, gRPC client, Kafka |
| **Payments** | Payment simulation, event handling | 3004 | Express, Kafka consumer, random failures |
| **Notifications** | Email notifications via Kafka | 3005 | Express, Nodemailer, Maildev, Kafka |

---

## 🏗️ Architecture

### Synchronous Communication (gRPC)
- Orders → Users (get user details)
- Orders → Payments (check status)

### Asynchronous Communication (Kafka)
- Users → `user.created`
- Products → `product.created`, `product.updated`
- Orders → `order.created`, `order.updated`
- Payments → `payment.attempted`, `payment.succeeded`, `payment.failed`
- Notifications: Consumes all events, sends emails

### Supporting Infrastructure
- **PostgreSQL**: Main database
- **Redis**: Caching layer
- **Kafka with KRaft**: Event streaming
- **Maildev**: Email testing (local dev)
- **OpenTelemetry**: Distributed tracing
- **Envoy**: API Gateway
- **Docker Compose**: Local orchestration

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **pnpm** 8+
- **Docker** and **Docker Compose**
- **Git**

### Step 1: Clone and Install

```bash
git clone https://github.com/your-username/ecomm-microservices.git
cd ecomm-microservices
pnpm install
```

### Step 2: Start Infrastructure

```bash
# Start all Docker services (Postgres, Redis, Kafka, Maildev, etc.)
docker compose up -d

# Verify services are running
docker compose ps
```

### Step 3: Run Migrations & Seeds

```bash
# Create tables in all services
pnpm run migrate:all

# Seed initial data (admin user, sample products)
pnpm run seed:all
```

### Step 4: Start Development Environment

**Option A: Start all services concurrently**
```bash
pnpm dev
```

**Option B: Start individual services in separate terminals**
```bash
# Terminal 1
pnpm dev:users

# Terminal 2
pnpm dev:products

# Terminal 3
pnpm dev:orders

# Terminal 4
pnpm dev:payments

# Terminal 5
pnpm dev:notifications
```

### Step 5: Test the System

```bash
# Health check
curl http://localhost:3001/health
# Expected: { "status": "ok", "service": "users" }

# Create new user
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123456",
    "firstName": "Demo",
    "lastName": "User"
  }'

# View Maildev (local email testing)
open http://localhost:1080
```
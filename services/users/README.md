# Users Service

User authentication and management service. Handles signup, login, JWT token generation, and publishes user events to Kafka.

## Features

- User signup with email and password
- User login with JWT token generation
- Password hashing with bcrypt
- User profile retrieval
- Admin user seed migration
- Kafka event publishing (user.created, user.updated)
- Health and readiness checks

## Service Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|----------------|
| POST | /auth/signup | Create new user account | No |
| POST | /auth/login | Authenticate and get JWT token | No |
| GET | /auth/me | Get current user profile | Yes |
| GET | /health | Service health check | No |
| GET | /ready | Service readiness check | No |

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=ecomm_dev

# Service
SERVICE_PORT=8001
NODE_ENV=development
LOG_LEVEL=debug

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRY=24h

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=users-service
```

## Running Locally

### Prerequisites
- Node.js >= 18
- PostgreSQL running (via docker-compose)
- Kafka running (via docker-compose)

### Setup & Run

1. Install dependencies (from root):
   ```bash
   pnpm install
   ```

2. Start local infrastructure:
   ```bash
   pnpm run docker:up
   ```

3. Run migrations:
   ```bash
   pnpm run migrate:all
   ```

4. Run seeds:
   ```bash
   pnpm run seed:all
   ```

5. Start users service:
   ```bash
   pnpm --filter users dev
   ```

Service will start on http://localhost:8001

## Testing

### Unit Tests
```bash
pnpm --filter users test
```

### Watch Mode
```bash
pnpm --filter users test:watch
```

### Manual Testing with curl

**Signup:**
```bash
curl -X POST http://localhost:8001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ecomm.local",
    "password": "admin123"
  }'
```

**Get Profile (with token):**
```bash
curl -X GET http://localhost:8001/auth/me \
  -H "Authorization: Bearer <token>"
```

## Pre-seeded Credentials

- **Admin user**: email: `admin@ecomm.local`, password: `admin123`
- **Test user**: email: `test@example.com`, password: `password123`

## Database Migrations

Create new migration:
Create a new file in `src/migrations/` following the naming pattern `XXX_description.js` (e.g., `002_add_user_phone.js`).
The migration should export an `up()` function that uses raw SQL with `getDb()` from `../db.js`.

Run migrations:
```bash
# Run all migrations for all services
pnpm run migrate:all

# Or run migrations manually
node scripts/run-migrations.js
```

Rollback migrations:
Rollbacks need to be done manually by running the `down()` function from the migration file, or by executing the rollback SQL directly.

## Docker Build

Build Docker image:
```bash
docker build -t ecomm-users:latest .
```

Run container:
```bash
docker run -p 8001:8001 --env-file .env ecomm-users:latest
```

## What's Next?

After getting the users service running:
1. Create the products service (list/filter endpoints)
2. Implement Kafka consumer patterns in notifications service
3. Add gRPC server implementation in users service for queries by other services
4. Create orders service with integration to users service via gRPC
5. Implement payments service with Kafka event handling

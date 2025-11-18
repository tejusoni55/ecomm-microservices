---
title: Building Microservices with Node.js: Part 3 - Dockerization, CI/CD, and AWS Deployment
description: Deploy microservices to AWS using Docker, ECR, ECS, and GitHub Actions
tags: nodejs, docker, aws, ci-cd, ecs, ecr
reading_time: 14 min
---

# Building Microservices with Node.js: Part 3 - Dockerization, CI/CD, and AWS Deployment

## Short Summary

In Parts 1-2, we built a fully functional microservices platform running locally. Now we'll containerize each service with production-ready Dockerfiles, set up GitHub Actions for automated testing and building, and prepare for deployment to AWS (ECS, ECR, RDS).

By the end of this post, you'll have:
- Production-ready Docker images for each service
- Automated CI/CD pipeline via GitHub Actions
- AWS deployment templates and documentation
- Health checks and readiness probes configured
- Environment-specific configurations

---

## Prerequisites

- Completed Parts 1-2 of this series
- Docker installed locally (for testing images)
- GitHub account with repository set up
- AWS account (free tier sufficient for testing)
- Understanding of Docker and basic AWS services

## Estimated Reading Time: 14 minutes
## Estimated Coding Time: 45-60 minutes

---

## Section 1: Multi-Stage Dockerfiles

### Step 1: Users Service Dockerfile

[INSERT: services/users/Dockerfile]

Multi-stage build benefits:
- Stage 1 (builder): Install all dependencies
- Stage 2 (runtime): Copy only built app, smaller final image
- Reduces image size by 70-90%

Example pattern:
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Runtime
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

### Step 2: Optimize Docker Images

Strategies:
- Use Alpine Linux (5MB vs 300MB+)
- Remove dev dependencies in production
- Use `.dockerignore` to exclude unnecessary files
- Pin exact Node versions

Create `.dockerignore`:
```
node_modules
.git
.env
.env.*
tests
jest.config.js
*.md
.DS_Store
coverage
dist
build
```

### Step 3: Test Docker Images Locally

```bash
# Build image for users service
docker build -t users-service:latest services/users/

# Run container
docker run \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=password \
  -e DB_NAME=ecomm_dev \
  -e JWT_SECRET=dev-secret \
  -e KAFKA_BROKERS=host.docker.internal:9092 \
  -p 3001:3001 \
  users-service:latest

# Test health endpoint
curl http://localhost:3001/health
```

### Step 4: Docker Compose with Service Images

Update `docker-compose.yml` to include services:

```yaml
services:
  users:
    build:
      context: .
      dockerfile: services/users/Dockerfile
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      KAFKA_BROKERS: kafka:29092
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_healthy

  # Similar for products, orders, payments, notifications
```

Run all services in Docker:
```bash
docker compose -f docker-compose.yml -f docker-compose.services.yml up
```

---

## Section 2: GitHub Actions CI/CD Pipeline

### Step 5: Create GitHub Actions Workflow

[INSERT: .github/workflows/ci.yml]

Workflow triggers:
- Push to main/develop branches
- Pull requests
- Manual trigger (workflow_dispatch)

Key steps:
1. **Checkout**: Get code
2. **Setup Node**: Install Node.js and pnpm
3. **Install**: `pnpm install`
4. **Lint**: Run linters (if configured)
5. **Test**: Run Jest tests
6. **Build**: Build Docker images
7. **Push**: Push to ECR (with AWS credentials)

### Step 6: Example CI Workflow

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: ecomm_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
        env:
          DB_HOST: localhost
          DB_USER: postgres
          DB_PASSWORD: password
          DB_NAME: ecomm_test

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker images
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY_USERS: ecomm-users
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_USERS:$IMAGE_TAG services/users/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_USERS:$IMAGE_TAG
          # Repeat for other services
```

---

## Section 3: AWS Deployment Preparation

### Step 7: AWS Resources Overview

Services you'll use:
- **ECR** (Elastic Container Registry): Store Docker images
- **ECS** (Elastic Container Service): Run containers
- **RDS** (Relational Database Service): PostgreSQL database
- **ElastiCache**: Redis cache
- **MSK** (Managed Streaming for Kafka): Kafka cluster
- **ALB** (Application Load Balancer): Load balancing and routing
- **Secrets Manager**: Store secrets securely

### Step 8: Create AWS Deployment Documentation

[INSERT: deploy/aws/README.md]

Essential documentation:
- AWS account setup steps
- Creating ECR repositories
- Creating RDS PostgreSQL instance
- Configuring security groups
- Environment variables for production
- Cost estimation

### Step 9: ECS Task Definition Template

[INSERT: deploy/ecs/task-definition.json]

Example structure:
```json
{
  "family": "ecomm-users",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "users",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/ecomm-users:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:ecomm/db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ecomm-users",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Step 10: Infrastructure as Code Template (Terraform)

[INSERT: deploy/terraform/main.tf]

Terraform advantages:
- Version control for infrastructure
- Repeatable deployments
- Easy to modify and destroy

Basic structure:
```hcl
provider "aws" {
  region = var.aws_region
}

# ECR Repository
resource "aws_ecr_repository" "users" {
  name                 = "ecomm-users"
  image_tag_mutability = "MUTABLE"
}

# RDS PostgreSQL
resource "aws_db_instance" "ecomm" {
  identifier          = "ecomm-postgres"
  engine              = "postgres"
  engine_version      = "15.3"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  username            = "postgres"
  password            = random_password.db_password.result
  skip_final_snapshot = true  # Only for dev!
}

# ECS Cluster
resource "aws_ecs_cluster" "ecomm" {
  name = "ecomm-cluster"
}
```

---

## Section 4: Environment-Specific Configuration

### Step 11: Environment Variables Management

Create environment files:

**deploy/envs/.env.development**
```
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
LOG_LEVEL=debug
KAFKA_BROKERS=localhost:9092
```

**deploy/envs/.env.production**
```
NODE_ENV=production
DB_HOST=ecomm-postgres.XXXX.rds.amazonaws.com
DB_PORT=5432
LOG_LEVEL=warn
KAFKA_BROKERS=kafka-broker-1:9092,kafka-broker-2:9092
REDIS_URL=redis://ecomm-redis:6379
```

### Step 12: Secrets Management

Use AWS Secrets Manager:

```bash
# Store database password
aws secretsmanager create-secret \
  --name ecomm/db-password \
  --secret-string "your-secure-password"

# Store JWT secret
aws secretsmanager create-secret \
  --name ecomm/jwt-secret \
  --secret-string "your-super-secret-jwt-key"

# Reference in ECS task definition
{
  "name": "JWT_SECRET",
  "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:ecomm/jwt-secret"
}
```

Never commit secrets to git!

---

## Section 5: Health Checks and Monitoring

### Step 13: Health Check Endpoints

All services should implement:

```javascript
// GET /health - Shallow check (always fast)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'users' });
});

// GET /ready - Deep check (checks dependencies)
app.get('/ready', async (req, res) => {
  try {
    const db = getDb();
    await db.raw('SELECT 1');
    
    // Check Kafka connectivity if critical
    const producer = await getProducer();
    
    res.json({ status: 'ready', service: 'users' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

### Step 14: CloudWatch Monitoring

Configure in task definition:
```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/ecomm-users",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "ecs"
  }
}
```

View logs:
```bash
aws logs tail /ecs/ecomm-users --follow
```

Create CloudWatch alarms:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ecomm-users-cpu-high \
  --alarm-description "Alert when CPU is high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## Section 6: Database Migration in Production

### Step 15: Running Migrations on Deployment

Two approaches:

**Option A: Init Container in ECS Task**
```json
{
  "name": "migrate",
  "image": "ECR_REGISTRY/ecomm-users:latest",
  "essential": false,
  "command": ["pnpm", "migrate:latest"],
  "environment": [
    { "name": "DB_HOST", "value": "ecomm.XXXX.rds.amazonaws.com" }
  ]
}
```

**Option B: GitHub Actions Before Deployment**
```yaml
- name: Run migrations
  run: |
    export DB_HOST=${{ secrets.PROD_DB_HOST }}
    export DB_PASSWORD=${{ secrets.PROD_DB_PASSWORD }}
    pnpm run migrate:all
```

### Step 16: Database Backup Strategy

```bash
# Automated RDS backups via AWS
aws rds create-db-snapshot \
  --db-instance-identifier ecomm-postgres \
  --db-snapshot-identifier ecomm-backup-$(date +%Y%m%d)

# Restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ecomm-postgres-restored \
  --db-snapshot-identifier ecomm-backup-20240101
```

---

## Section 7: Deployment Process

### Step 17: Manual Deployment with AWS CLI

```bash
#!/bin/bash
# Deploy users service to ECS

AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
IMAGE_TAG=$(git rev-parse --short HEAD)

# 1. Build and push image
docker build -t $ECR_REGISTRY/ecomm-users:$IMAGE_TAG services/users/
docker push $ECR_REGISTRY/ecomm-users:$IMAGE_TAG

# 2. Update ECS service
aws ecs update-service \
  --cluster ecomm-cluster \
  --service ecomm-users-service \
  --force-new-deployment \
  --region $AWS_REGION

# 3. Wait for deployment
aws ecs wait services-stable \
  --cluster ecomm-cluster \
  --services ecomm-users-service \
  --region $AWS_REGION

echo "Deployment complete!"
```

### Step 18: Automated Deployment via GitHub Actions

Extend CI workflow to deploy:
```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  
  steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Deploy to ECS
      run: |
        aws ecs update-service \
          --cluster ecomm-cluster \
          --service ecomm-users-service \
          --force-new-deployment
```

---

## Section 8: Rollback and Disaster Recovery

### Step 19: Rollback Procedure

```bash
# Quick rollback: Deploy previous image version
aws ecs update-service \
  --cluster ecomm-cluster \
  --service ecomm-users-service \
  --force-new-deployment

# Or specify exact image
aws ecs update-service \
  --cluster ecomm-cluster \
  --service ecomm-users-service \
  --task-definition ecomm-users:123 \
  --force-new-deployment
```

### Step 20: Database Rollback

```bash
# 1. Take snapshot before deployment
aws rds create-db-snapshot \
  --db-instance-identifier ecomm-postgres \
  --db-snapshot-identifier pre-deploy-$(date +%s)

# 2. If needed, restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ecomm-postgres-restore \
  --db-snapshot-identifier pre-deploy-XXXXX

# 3. Point services to new instance
# Update RDS endpoint in ECS task definition and redeploy
```

---

## Section 9: Cost Optimization

### Step 21: Right-Sizing Resources

Monitor and adjust:
```bash
# View ECS container insights
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=ecomm-users \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-08T00:00:00Z \
  --period 3600 \
  --statistics Average
```

Optimization tips:
- Use t3.micro for dev, t3.small for prod initially
- Set up auto-scaling based on CPU/memory
- Use scheduled scaling (lower at night)
- Consider spot instances for non-critical services

---

## Section 10: Production Checklist

Before deploying to production:

- [ ] All tests pass in CI pipeline
- [ ] Docker images build successfully
- [ ] Security scanning passes (Trivy, Snyk)
- [ ] Environment variables documented
- [ ] Secrets stored in AWS Secrets Manager
- [ ] RDS backup configured
- [ ] CloudWatch alarms created
- [ ] Health checks implemented
- [ ] Logging configured
- [ ] Load testing completed
- [ ] Runbook created for common issues
- [ ] Team trained on deployment process

---

## What's Next?

In **Part 4**, we'll:
1. Create Kubernetes manifests for all services
2. Migrate to Amazon EKS
3. Implement service mesh with Istio
4. Set up advanced monitoring with Prometheus/Grafana
5. Implement canary deployments

---

## Key Takeaways

✓ Created production-ready multi-stage Dockerfiles
✓ Set up complete GitHub Actions CI/CD pipeline
✓ Prepared AWS deployment templates
✓ Configured environment-specific settings
✓ Implemented health checks for observability
✓ Documented deployment and rollback procedures
✓ Optimized costs and resources

---

**Next Article**: [Part 4 - Kubernetes, EKS, and Service Mesh](04-migrate-to-k8s-eks.md)

**Previous Article**: [Part 2 - Full Implementation of All Services](02-full-implementation.md)

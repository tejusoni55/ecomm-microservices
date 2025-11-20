# Multi-stage Dockerfile for payments service
FROM node:20-alpine as builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy core workspace definition files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy source directories
COPY libs ./libs
COPY infra ./infra
COPY services/payments ./services/payments

# Install dependencies for the entire workspace
RUN pnpm install --frozen-lockfile

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Copy node_modules and all sources from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/services/payments/ ./services/payments/
COPY --from=builder /app/services/payments/.env.example ./services/payments/.env

WORKDIR /app/services/payments
EXPOSE 8004
ENV NODE_ENV=production
CMD ["pnpm", "start"]
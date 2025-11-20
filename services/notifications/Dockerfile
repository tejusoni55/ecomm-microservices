# Multi-stage Dockerfile for users service
FROM node:20-alpine as builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy core workspace definition files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy source directories
COPY libs ./libs
COPY infra ./infra
COPY services/notifications ./services/notifications

# Install dependencies for the entire workspace
RUN pnpm install --frozen-lockfile

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Copy node_modules and all sources from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/services/notifications/ ./services/notifications/
COPY --from=builder /app/services/notifications/.env.example ./services/notifications/.env

WORKDIR /app/services/notifications
EXPOSE 8005
ENV NODE_ENV=production
CMD ["pnpm", "start"]

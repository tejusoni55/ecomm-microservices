# Multi-stage Dockerfile for products service
FROM node:20-alpine as builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy core workspace definition files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy source directories
COPY libs ./libs
COPY infra ./infra
COPY services/products ./services/products

# Install dependencies for the entire workspace
RUN pnpm install --frozen-lockfile

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Copy node_modules and all sources from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/services/products/ ./services/products/
COPY --from=builder /app/services/products/.env.example ./services/products/.env

WORKDIR /app/services/products
EXPOSE 8002
ENV NODE_ENV=production
CMD ["pnpm", "start"]
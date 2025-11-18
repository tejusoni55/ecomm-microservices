# Multi-stage Dockerfile for users service
FROM node:18-alpine as builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/package.json ./

COPY services/users ./services/users
COPY libs ./libs

WORKDIR /app/services/users

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "src/index.js"]

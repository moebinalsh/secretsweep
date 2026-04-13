# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# Copy server code
COPY server/ ./server/

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 -S secretsweep && \
    adduser -S secretsweep -u 1001 && \
    chown -R secretsweep:secretsweep /app
USER secretsweep

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server/index.js"]

# ---- Build Stage ----
FROM node:20-slim AS builder
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --production

# Copy application source
COPY . .

# ---- Production Stage ----
FROM node:20-slim
WORKDIR /app

# Copy from builder
COPY --from=builder /app .

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose Cloud Run default port
EXPOSE 8080

# Security: run as non-root user
USER node

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the server
CMD ["node", "server.js"]

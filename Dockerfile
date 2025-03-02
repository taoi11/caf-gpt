FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build:prod

# Production stage
FROM node:20-slim

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create a non-root user and switch to it
RUN useradd -m appuser
USER appuser

# Expose the port
EXPOSE 8080

# Health check for fly.io
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/server/index.js"]
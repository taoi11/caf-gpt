FROM node:current-slim AS builder

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy application code
COPY . .

# Build the application
RUN npm run build:prod

# Production stage
FROM node:current-alpine

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install curl for health checks (using alpine package manager)
RUN apk --no-cache add curl

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create a non-root user and switch to it
RUN adduser -D appuser
USER appuser

# Expose the port
EXPOSE 8080

# Health check for fly.io
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/server/index.js"]
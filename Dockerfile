# Build stage
FROM node:alpine-slim as builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Copy source files and build
COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

# Production build without source maps
RUN npm run build:prod && \
    rm -rf src

# Production stage
FROM node:alpine-slim
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only production files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/public ./public

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*

# Set ownership and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Configure Node.js options for production
ENV NODE_OPTIONS="--max-old-space-size=128"

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server/index.js"]
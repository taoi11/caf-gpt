# Build stage
FROM node:lts as builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies with better error logging
COPY package*.json ./
RUN npm install && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Copy source files and build
COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

# Production build without source maps
RUN npm run build:prod

# Production stage
FROM node:lts
ENV NODE_ENV=production

# Install curl for healthcheck and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser && \
    mkdir -p /app

WORKDIR /app

# Copy only production files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/prompts ./src/prompts

# Install production dependencies with better error logging
RUN npm install --verbose --only=production && \
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
# Build stage
FROM node:alpine as builder
WORKDIR /app
COPY package*.json ./
# Install dependencies and clean npm cache
RUN npm ci && \
    npm cache clean --force

# Copy only necessary source files
COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build server code and remove source maps
RUN npm run build && \
    find dist -name "*.map" -delete

# Production stage
FROM node:alpine-slim
# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only production files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/public ./public

# Install only production dependencies and clean up
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Change ownership and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 3000

# Start the server
ENTRYPOINT ["node", "dist/server/index.js"]
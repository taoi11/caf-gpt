# Build stage
FROM node:alpine as builder
WORKDIR /app
COPY package*.json ./
# Install all dependencies (including dev dependencies)
RUN npm install
# Copy source code
COPY . .
# Build server code
RUN npm run build

# Production stage
FROM node:alpine
# Set production environment
ENV NODE_ENV=production
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production
# Copy built files from builder stage
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/public ./public
# Change ownership to non-root user
RUN chown -R appuser:appgroup /app
# Switch to non-root user
USER appuser
# Expose port
EXPOSE 3000
# Start the server using entrypoint
ENTRYPOINT ["node", "dist/server/index.js"]
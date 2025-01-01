FROM node:lts as builder
# Set working directory
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install dependencies
RUN npm install
# Copy source files
COPY . .
# Build the application
RUN npm run build:prod

# Runtime stage
FROM node:lts
# Install curl for health check
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy only the necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/prompts ./src/prompts
# Install only production dependencies
RUN npm install --production
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server/index.js"]
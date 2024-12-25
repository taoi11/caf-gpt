# Build stage
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Build server code
RUN npm run build

# Production stage
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start the server
# Note: Environment variables should be passed at runtime
CMD ["node", "dist/server/index.js"] 
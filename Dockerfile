FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build:prod

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "dist/server/index.js"]
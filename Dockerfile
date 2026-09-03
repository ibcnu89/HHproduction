# Dockerfile for HHproduction Express Server
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (need dev deps for build)
RUN npm ci

# Copy application code
COPY server.js ./
COPY lib/ ./lib/
COPY api/ ./api/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY vite.config.js ./
COPY index.html ./

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm ci --omit=dev

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]

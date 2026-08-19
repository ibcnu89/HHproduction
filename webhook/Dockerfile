# Dockerfile for Resend Webhook Handler
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy application code
COPY resend-webhook-server.js ./

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "resend-webhook-server.js"]
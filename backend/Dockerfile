# ─── Clinic Appointment & Patient Tracker — Backend Dockerfile ───
FROM docker.io/library/node:22-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install dependencies (only production)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs

# Expose default backend port
EXPOSE 5000

# Non-root user for security
USER node

# Start API server
CMD ["node", "src/server.js"]

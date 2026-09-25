# ─── Clinic Appointment & Patient Tracker — Frontend Dockerfile ───

# Stage 1: Build Vite React application
FROM docker.io/library/node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source code and build config
COPY . .

# Build production bundle
RUN npm run build

# Stage 2: Serve static bundle via Nginx
FROM docker.io/library/nginx:alpine AS runner

# Copy customized Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

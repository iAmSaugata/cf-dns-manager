# Multi-stage build: Node 20 Alpine
FROM node:20-alpine AS builder
WORKDIR /app

# Install server deps
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix ./server

# Install frontend deps
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix ./frontend

# Copy source
COPY server ./server
COPY frontend ./frontend

# Build frontend
RUN npm run build --prefix ./frontend

# --- Runtime image ---
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy server and built frontend
COPY --from=builder /app/server /app/server
COPY --from=builder /app/frontend/dist /app/server/public

# Install server production deps
RUN npm ci --omit=dev --prefix ./server

EXPOSE 8080
CMD ["node", "server/index.mjs"]

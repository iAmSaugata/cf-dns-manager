# Multi-stage build: frontend -> backend runtime
# Stage 1: Frontend builder
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: Runtime (backend + built frontend)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY auth.mjs ./
COPY logger.mjs ./
COPY cloudflare.mjs ./
# Copy pre-built frontend
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 8080
CMD ["node", "server.mjs"]

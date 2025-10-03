# ==============================
# Multi-stage build (Node 20 Alpine)
# ==============================

# --- Stage 1: build frontend ---
FROM node:20-alpine AS builder
WORKDIR /app
# Copy frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build

# --- Stage 2: runtime (backend + built frontend) ---
FROM node:20-alpine AS runtime
WORKDIR /app

# Install backend deps
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend ./backend

# Copy built frontend to backend/frontend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy example env for convenience
COPY .env.example .env

WORKDIR /app/backend
CMD ["npm", "start"]

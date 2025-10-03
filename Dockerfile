# ---------- Build frontend ----------
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend ./
RUN npm run build

# ---------- Runtime (serves API + static) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Install backend deps
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev --no-audit --no-fund
# Copy sources
COPY backend ./backend
# Copy built frontend into backend ../frontend/dist
COPY --from=build-frontend /app/frontend/dist ./frontend/dist
EXPOSE 8080
ENV PORT=8080
CMD ["node", "backend/server.js"]

# ====== Frontend build ======
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
# Copy package manifest(s) only to leverage Docker cache; lock file is optional
COPY frontend/package*.json ./
# Use npm install (not ci) so build works even without a lockfile
RUN npm install --no-audit --no-fund
# Copy source and build
COPY frontend ./
RUN npm run build

# ====== Backend build ======
FROM node:20-alpine AS backend
WORKDIR /app/backend
# Copy package manifest(s); lockfile optional
COPY backend/package*.json ./
# Install prod deps only
RUN npm install --omit=dev --no-audit --no-fund
COPY backend ./

# ====== Final image ======
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Copy backend runtime
COPY --from=backend /app/backend /app/backend
# Copy frontend dist to public dir served by Express
COPY --from=frontend /app/frontend/dist /app/backend/public
EXPOSE 8080
CMD ["node", "backend/server.mjs"]

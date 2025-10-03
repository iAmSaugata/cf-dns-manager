# ====== Frontend build ======
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend ./
RUN npm run build

# ====== Backend build ======
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --only=production
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

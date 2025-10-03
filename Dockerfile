
# --------- Build Frontend ---------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/vite.config.js frontend/index.html frontend/favicon.svg ./
COPY frontend/src ./src
RUN npm install && npm run build

# --------- Backend Runtime ---------
FROM node:20-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
RUN npm install --omit=dev
# Copy backend sources
COPY backend/ ./
# Copy built frontend into backend/public (vite already outputs there, but copy for safety)
COPY --from=frontend /app/backend/public ./public

EXPOSE 8080
CMD ["npm","start"]

# --- Frontend build stage ---
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend ./
RUN npm run build

# --- Server stage ---
FROM node:20-alpine AS server
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY server ./
# copy built frontend into server's public dir
COPY --from=frontend /app/frontend/dist ./public
EXPOSE 8080
CMD ["node", "src/index.mjs"]

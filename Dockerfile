# --- build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY frontend ./frontend
COPY vite.config.js ./vite.config.js
RUN npm run build

# --- run stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./server.js
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node","server.js"]

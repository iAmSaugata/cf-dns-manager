FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
WORKDIR /app/frontend
RUN npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 5000
CMD ["node","server.js"]

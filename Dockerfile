FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY client/ ./client/
ENV CLIENT_DIR=/app/client
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]

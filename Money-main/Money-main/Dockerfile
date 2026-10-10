# ---- Build stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/app.db
ENV TZ=Europe/Madrid

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules/sql.js/dist/sql-wasm.wasm ./node_modules/sql.js/dist/sql-wasm.wasm

RUN mkdir -p /data

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "--enable-source-maps", "server/dist/index.js"]

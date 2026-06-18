# SuperLoopz backend — Node.js + Express
# Multi-stage keeps the runtime image small; ARM-compatible base for Oracle VPS.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# Run pending migrations, then boot the API.
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]

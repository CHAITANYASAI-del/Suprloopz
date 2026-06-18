# SuperLoopz frontend — Next.js (standalone output)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Which portal this image serves: 'vendor' (default) or 'admin'. NEXT_PUBLIC_*
# vars are inlined at build time, so it must be set before `next build`.
ARG NEXT_PUBLIC_PORTAL=vendor
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_VENDOR_URL=http://localhost:3001
ARG NEXT_PUBLIC_ADMIN_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PORTAL=$NEXT_PUBLIC_PORTAL
ENV NEXT_PUBLIC_VENDOR_URL=$NEXT_PUBLIC_VENDOR_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

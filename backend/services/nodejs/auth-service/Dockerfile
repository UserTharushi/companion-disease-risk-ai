FROM node:20-alpine AS builder
WORKDIR /repo
COPY package*.json ./
COPY backend/services/nodejs/auth-service/package*.json ./backend/services/nodejs/auth-service/
COPY packages/shared-types/package*.json ./packages/shared-types/
RUN npm install --workspace @companion-ai/shared-types --workspace @companion-ai/auth-service
COPY tsconfig.base.json ./
COPY backend/services/nodejs/auth-service ./backend/services/nodejs/auth-service
COPY packages/shared-types ./packages/shared-types
RUN npx tsc -p backend/services/nodejs/auth-service/tsconfig.json --noEmit false --allowImportingTsExtensions false

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/backend/services/nodejs/auth-service/dist ./dist
COPY --from=builder /repo/backend/services/nodejs/auth-service/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/shared-types ./packages/shared-types
EXPOSE 4001
CMD ["node", "dist/server.js"]

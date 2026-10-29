# One image: the NestJS API serving the built Angular UI.
FROM node:22-bookworm-slim AS ui
WORKDIR /src/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npx ng build

FROM node:22-bookworm-slim AS api
WORKDIR /src/api
COPY api/package*.json ./
COPY api/prisma ./prisma
RUN npm ci
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends rclone ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api /src/api/node_modules ./node_modules
COPY --from=api /src/api/dist ./dist
COPY --from=api /src/api/package.json ./
COPY --from=ui /src/ui/dist/ui/browser ./ui
ENV NODE_ENV=production UI_DIST=/app/ui
EXPOSE 8101
CMD ["node", "dist/main.js"]

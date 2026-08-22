FROM node:24.17.0-bookworm-slim AS build

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build --workspace=@taptime/core \
  && npm run build --workspace=@taptime/administration-contract \
  && npm run build --workspace=@taptime/mobile-work-contract \
  && npm run build --workspace=@taptime/offline-sync-contract \
  && npm run build --workspace=@taptime/time-entry-export-contract \
  && npm run build --workspace=@taptime/time-review-contract \
  && npm run build --workspace=@taptime/backend-schema \
  && npm run build --workspace=@taptime/backend-identity \
  && npm run build --workspace=@taptime/backend-administration \
  && npm run build --workspace=@taptime/backend-lifecycle \
  && npm run build --workspace=@taptime/backend-mobile-work \
  && npm run build --workspace=@taptime/backend-offline-sync \
  && npm run build --workspace=@taptime/backend-read-model \
  && npm run build --workspace=@taptime/backend-time-export \
  && npm run build --workspace=@taptime/backend-time-review \
  && npm run build --workspace=@taptime/backend-api
RUN npx esbuild apps/backend-api/src/main.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=esm \
  --external:pg-native \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --sourcemap \
  --outfile=/runtime/main.js

FROM node:24.17.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /runtime/main.js /runtime/main.js.map ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then(response => { if (response.status !== 200) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "main.js"]

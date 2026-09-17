FROM node:24.17.0-bookworm-slim AS build

ARG TAPTIME_VERSION
ARG VITE_TAPTIME_SUPABASE_URL
ARG VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY
ENV VITE_TAPTIME_SUPABASE_URL=$VITE_TAPTIME_SUPABASE_URL
ENV VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY=$VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$TAPTIME_VERSION" \
    || { printf 'TAPTIME_VERSION is required.\n' >&2; exit 1; }; \
  test -n "$VITE_TAPTIME_SUPABASE_URL" \
    || { printf 'VITE_TAPTIME_SUPABASE_URL is required.\n' >&2; exit 1; }; \
  test -n "$VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY" \
    || { printf 'VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY is required.\n' >&2; exit 1; }

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build --workspace=@taptime/administration-contract \
  && npm run build --workspace=@taptime/time-entry-export-contract \
  && npm run build --workspace=@taptime/time-review-contract \
  && npm run build --workspace=@taptime/admin-web -- --base="/releases/$TAPTIME_VERSION/"
RUN printf '%s\n' "$TAPTIME_VERSION" > /app/apps/admin-web/dist/version.txt

FROM scratch

COPY --from=build /app/apps/admin-web/dist /admin-web

CMD ["/admin-web"]

FROM node:24.17.0-bookworm-slim AS build

ARG TAPTIME_VERSION
RUN test -n "$TAPTIME_VERSION"

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build --workspace=@taptime/time-review-contract \
  && npm run build --workspace=@taptime/admin-web -- --base="/releases/$TAPTIME_VERSION/"
RUN printf '%s\n' "$TAPTIME_VERSION" > /app/apps/admin-web/dist/version.txt

FROM scratch

COPY --from=build /app/apps/admin-web/dist /admin-web

CMD ["/admin-web"]

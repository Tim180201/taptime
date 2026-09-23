FROM node:24.17.0-bookworm-slim AS build
ARG TAPTIME_VERSION
RUN printf '%s\n' "$TAPTIME_VERSION" | grep -Eq '^[0-9a-f]{7}$'
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=@taptime/landing-web -- --base="/releases/$TAPTIME_VERSION/" \
  && printf '%s\n' "$TAPTIME_VERSION" > apps/landing-web/dist/version.txt
FROM scratch
COPY --from=build /app/apps/landing-web/dist /landing-web
CMD ["/landing-web"]

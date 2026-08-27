FROM alpine:3.22.1 AS metadata

ARG TAPTIME_VERSION
RUN test -n "$TAPTIME_VERSION" \
  && printf '%s\n' "$TAPTIME_VERSION" > /version.txt

FROM scratch

COPY --chmod=0700 infrastructure/backup/taptime-backup /operations/usr/local/sbin/taptime-backup
COPY --chmod=0700 infrastructure/backup/taptime-restore-verify /operations/usr/local/sbin/taptime-restore-verify
COPY --chmod=0755 infrastructure/monitoring/taptime-immediate-monitor /operations/usr/local/sbin/taptime-immediate-monitor
COPY --chmod=0755 infrastructure/monitoring/taptime-daily-monitor /operations/usr/local/sbin/taptime-daily-monitor

COPY infrastructure/backup/*.service infrastructure/backup/*.timer /operations/etc/systemd/system/
COPY infrastructure/monitoring/*.service infrastructure/monitoring/*.timer /operations/etc/systemd/system/
COPY infrastructure/logging/taptime-journald.conf /operations/etc/systemd/journald.conf.d/60-taptime.conf

COPY infrastructure/docker-compose.server.yml /operations/opt/taptime/source/infrastructure/docker-compose.server.yml
COPY infrastructure/caddy/Caddyfile /operations/opt/taptime/source/infrastructure/caddy/Caddyfile
COPY apps/backend-schema/migrations /operations/opt/taptime/source/apps/backend-schema/migrations
COPY --from=metadata /version.txt /operations/version.txt
COPY --from=metadata /version.txt /operations/var/lib/taptime-deploy/operations-version

# The deploy controller is the one deliberate bootstrap exception. It is carried
# by the same immutable image, but only the Product Owner replaces it once from
# the Hetzner Console; the running controller never overwrites itself.
COPY --chmod=0755 infrastructure/deploy /bootstrap/taptime-deploy
COPY --from=metadata /version.txt /bootstrap/version.txt

CMD ["/operations"]

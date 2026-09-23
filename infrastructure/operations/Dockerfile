FROM alpine:3.22.1 AS metadata

ARG TAPTIME_VERSION
COPY infrastructure/operations/taptime-bootstrap /taptime-bootstrap.template
RUN printf '%s\n' "$TAPTIME_VERSION" | grep -Eq '^[0-9a-f]{7}$' \
  && printf '%s\n' "$TAPTIME_VERSION" > /version.txt \
  && sed "s/@TAPTIME_VERSION@/$TAPTIME_VERSION/g" \
    /taptime-bootstrap.template > /taptime-bootstrap \
  && ! grep -q '@TAPTIME_VERSION@' /taptime-bootstrap \
  && chmod 0755 /taptime-bootstrap

FROM alpine:3.22.1

RUN apk add --no-cache bash sudo

COPY --chmod=0700 infrastructure/operations/taptime-landing-password /operations/usr/local/sbin/taptime-landing-password
COPY --chmod=0700 infrastructure/operations/taptime-operator-grant /operations/usr/local/sbin/taptime-operator-grant
COPY --chmod=0700 infrastructure/operations/taptime-operator-db-login /operations/usr/local/sbin/taptime-operator-db-login
COPY --chmod=0700 infrastructure/backup/taptime-backup /operations/usr/local/sbin/taptime-backup
COPY --chmod=0700 infrastructure/backup/taptime-restore-verify /operations/usr/local/sbin/taptime-restore-verify
COPY --chmod=0700 infrastructure/backup/taptime-restore-activate /operations/usr/local/sbin/taptime-restore-activate
COPY --chmod=0700 infrastructure/backup/taptime-wal-receiver /operations/usr/local/sbin/taptime-wal-receiver
COPY --chmod=0700 infrastructure/backup/taptime-wal-archiver /operations/usr/local/sbin/taptime-wal-archiver
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
# by the same immutable image, but an authorized operator replaces it from the
# Hetzner Console for each approved controller change; it never overwrites itself.
COPY --chmod=0755 infrastructure/deploy /bootstrap/taptime-deploy
COPY --chmod=0755 infrastructure/operations/taptime-status /bootstrap/taptime-status
COPY --chmod=0440 infrastructure/operations/taptime-status.sudoers /bootstrap/taptime-status.sudoers
COPY --from=metadata /version.txt /bootstrap/version.txt
COPY --from=metadata /taptime-bootstrap /bootstrap/taptime-bootstrap

CMD ["/bootstrap/taptime-bootstrap"]

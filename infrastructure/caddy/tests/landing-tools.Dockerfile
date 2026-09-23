# Disposable Linux client for root-tool tests against the real local Caddy daemon.
FROM caddy:2.10.2-alpine
RUN apk add --no-cache bash curl docker-cli coreutils util-linux

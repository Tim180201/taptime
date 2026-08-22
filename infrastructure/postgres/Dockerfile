FROM postgres:17-bookworm

COPY apps/backend-schema/migrations /taptime-migrations
COPY infrastructure/postgres/init-database.sh /docker-entrypoint-initdb.d/00-taptime-migrations.sh
COPY infrastructure/postgres/local-runtime-logins.sql /docker-entrypoint-initdb.d/01-taptime-local-runtime-logins.sql

RUN chmod 0555 /docker-entrypoint-initdb.d/00-taptime-migrations.sh \
  && chmod 0444 /docker-entrypoint-initdb.d/01-taptime-local-runtime-logins.sql \
  && chmod 0444 /taptime-migrations/*.sql

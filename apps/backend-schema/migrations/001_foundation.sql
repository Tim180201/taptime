CREATE SCHEMA taptime_server;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taptime_employee') THEN
    CREATE ROLE taptime_employee NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taptime_administrator') THEN
    CREATE ROLE taptime_administrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taptime_server_lifecycle') THEN
    CREATE ROLE taptime_server_lifecycle NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;

CREATE TABLE taptime_server.users (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE taptime_server.identity_bindings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  issuer text NOT NULL CHECK (length(btrim(issuer)) > 0),
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT identity_bindings_issuer_subject_unique UNIQUE (issuer, subject),
  CONSTRAINT identity_bindings_revocation_order CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE taptime_server.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0)
);

CREATE TABLE taptime_server.memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  role text NOT NULL CHECK (role IN ('administrator', 'employee')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  revoked_at timestamptz,
  created_by_user_id uuid REFERENCES taptime_server.users (id),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT memberships_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT memberships_tenant_user_id_unique UNIQUE (organization_id, user_id, id),
  CONSTRAINT memberships_organization_user_unique UNIQUE (organization_id, user_id),
  CONSTRAINT memberships_creator_organization_fk FOREIGN KEY (organization_id, created_by_user_id)
    REFERENCES taptime_server.memberships (organization_id, user_id),
  CONSTRAINT memberships_revocation_order CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE UNIQUE INDEX memberships_one_active_per_user
  ON taptime_server.memberships (user_id)
  WHERE revoked_at IS NULL;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_identity_resolver') THEN
    CREATE ROLE taptime_identity_resolver
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_identity_resolver WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

DO $parent_roles$
DECLARE
  parent_role_name text;
BEGIN
  FOR parent_role_name IN
    SELECT parent_role.rolname
    FROM pg_catalog.pg_auth_members AS membership
    INNER JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    INNER JOIN pg_catalog.pg_roles AS parent_role
      ON parent_role.oid = membership.roleid
    WHERE member_role.rolname = 'taptime_identity_resolver'
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE %I FROM %I',
      parent_role_name,
      'taptime_identity_resolver'
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    INNER JOIN pg_catalog.pg_roles AS member_role
      ON member_role.oid = membership.member
    WHERE member_role.rolname = 'taptime_identity_resolver'
  ) THEN
    RAISE EXCEPTION 'taptime_identity_resolver must not inherit any parent role';
  END IF;
END
$parent_roles$;

CREATE FUNCTION taptime_server.resolve_request_actor(
  verified_issuer text,
  verified_subject text
)
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  membership_id uuid,
  membership_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server, pg_temp
ROWS 1
AS $$
  SELECT
    binding.user_id,
    membership.organization_id,
    membership.id AS membership_id,
    membership.role AS membership_role
  FROM taptime_server.identity_bindings AS binding
  INNER JOIN taptime_server.users AS resolved_user
    ON resolved_user.id = binding.user_id
  INNER JOIN taptime_server.memberships AS membership
    ON membership.user_id = resolved_user.id
  WHERE pg_catalog.length(pg_catalog.btrim(verified_issuer)) > 0
    AND pg_catalog.length(pg_catalog.btrim(verified_subject)) > 0
    AND binding.issuer = verified_issuer
    AND binding.subject = verified_subject
    AND binding.revoked_at IS NULL
    AND membership.revoked_at IS NULL
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM taptime_identity_resolver;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM taptime_identity_resolver;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM taptime_identity_resolver;
REVOKE ALL ON FUNCTION taptime_server.resolve_request_actor(text, text) FROM PUBLIC;

GRANT USAGE ON SCHEMA taptime_server TO taptime_identity_resolver;
GRANT EXECUTE ON FUNCTION taptime_server.resolve_request_actor(text, text)
  TO taptime_identity_resolver;

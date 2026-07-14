DO $unicode_contract$
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer < 170000
    OR pg_catalog.current_setting('server_version_num')::integer >= 180000
    OR pg_catalog.current_setting('server_encoding') <> 'UTF8'
    OR pg_catalog.unicode_version() <> '15.1'
  THEN
    RAISE EXCEPTION 'taptime-name-v1 requires PostgreSQL 17, UTF8 and Unicode 15.1'
      USING ERRCODE = '0A000';
  END IF;
END
$unicode_contract$;

DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_bootstrap_executor'
  ) THEN
    CREATE ROLE taptime_bootstrap_executor
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_bootstrap_function_owner'
  ) THEN
    CREATE ROLE taptime_bootstrap_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_bootstrap_executor WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_bootstrap_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

DO $database_acl$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC',
    pg_catalog.current_database()
  );
END
$database_acl$;

DO $normalize_role_graph$
DECLARE
  role_name text;
  role_oid oid;
  database_oid oid := (
    SELECT database.oid
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
  );
  parent_name text;
  member_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'taptime_bootstrap_executor',
    'taptime_bootstrap_function_owner'
  ]
  LOOP
    SELECT role.oid
    INTO STRICT role_oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = role_name;

    FOR parent_name IN
      SELECT parent.rolname
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', parent_name, role_name);
    END LOOP;

    FOR member_name IN
      SELECT member.rolname
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE parent.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', role_name, member_name);
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_shdepend AS dependency
      WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
        AND dependency.refobjid = role_oid
        AND dependency.dbid IN (0, database_oid)
    ) THEN
      RAISE EXCEPTION 'Bootstrap roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

ALTER TABLE taptime_server.audit_events
  ADD COLUMN operator_principal text,
  ADD CONSTRAINT audit_events_operator_principal_shape CHECK (
    operator_principal IS NULL
    OR (
      actor_user_id IS NULL
      AND pg_catalog.length(pg_catalog.btrim(operator_principal)) BETWEEN 1 AND 128
      AND pg_catalog.octet_length(operator_principal) <= 512
    )
  );

ALTER TABLE taptime_server.identity_bindings
  ADD CONSTRAINT identity_bindings_id_user_unique UNIQUE (id, user_id);

CREATE TABLE taptime_server.bootstrap_receipts (
  request_id uuid PRIMARY KEY,
  request_hash_version smallint NOT NULL CHECK (request_hash_version = 1),
  request_hash bytea NOT NULL CHECK (pg_catalog.octet_length(request_hash) = 32),
  operator_principal text NOT NULL CHECK (
    pg_catalog.length(pg_catalog.btrim(operator_principal)) BETWEEN 1 AND 128
    AND pg_catalog.octet_length(operator_principal) <= 512
  ),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  identity_binding_id uuid NOT NULL REFERENCES taptime_server.identity_bindings (id),
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT bootstrap_receipts_identity_binding_unique UNIQUE (identity_binding_id),
  CONSTRAINT bootstrap_receipts_user_unique UNIQUE (user_id),
  CONSTRAINT bootstrap_receipts_organization_unique UNIQUE (organization_id),
  CONSTRAINT bootstrap_receipts_membership_unique UNIQUE (membership_id),
  CONSTRAINT bootstrap_receipts_identity_result_fk FOREIGN KEY (
    identity_binding_id, user_id
  ) REFERENCES taptime_server.identity_bindings (id, user_id),
  CONSTRAINT bootstrap_receipts_membership_result_fk FOREIGN KEY (
    organization_id, user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id)
);

ALTER TABLE taptime_server.bootstrap_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.bootstrap_receipts FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.bootstrap_first_organization(
  requested_request_id uuid,
  requested_organization_name text,
  verified_issuer text,
  verified_subject text
)
RETURNS TABLE (
  result_status text,
  idempotent_retry boolean,
  result_user_id uuid,
  result_identity_binding_id uuid,
  result_organization_id uuid,
  result_membership_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
ROWS 1
AS $bootstrap$
DECLARE
  operator_name text := session_user;
  operator_role pg_catalog.pg_roles%ROWTYPE;
  operator_parent_count integer;
  database_oid oid := (
    SELECT database.oid
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
  );
  canonical_organization_name text;
  canonical_request_hash bytea;
  identity_lock_hash bytea;
  existing_receipt taptime_server.bootstrap_receipts%ROWTYPE;
  existing_binding taptime_server.identity_bindings%ROWTYPE;
  bootstrap_user_id uuid;
  bootstrap_binding_id uuid;
  bootstrap_organization_id uuid;
  bootstrap_membership_id uuid;
  binding_event_type text;
  invalid_code_point boolean;
BEGIN
  IF requested_request_id IS NULL
    OR requested_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RETURN QUERY SELECT 'invalid_request', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT role.*
  INTO operator_role
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = operator_name;

  SELECT pg_catalog.count(*)::integer
  INTO operator_parent_count
  FROM pg_catalog.pg_auth_members AS edge
  INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
  INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
  WHERE member.rolname = operator_name
    AND parent.rolname = 'taptime_bootstrap_executor';

  IF operator_role.rolname IS NULL
    OR operator_name IN ('taptime_bootstrap_executor', 'taptime_bootstrap_function_owner')
    OR (operator_name COLLATE "C") !~ '^taptime_bootstrap_operator_[a-z0-9]{12,36}$'
    OR NOT operator_role.rolcanlogin
    OR operator_role.rolinherit
    OR operator_role.rolsuper
    OR operator_role.rolcreatedb
    OR operator_role.rolcreaterole
    OR operator_role.rolreplication
    OR operator_role.rolbypassrls
    OR operator_role.rolvaliduntil IS NULL
    OR operator_role.rolvaliduntil <= pg_catalog.clock_timestamp()
    OR operator_role.rolvaliduntil > pg_catalog.clock_timestamp() + interval '24 hours'
    OR operator_parent_count <> 1
    OR pg_catalog.current_setting('role', true) <> 'taptime_bootstrap_executor'
    OR (
      SELECT COALESCE(
        pg_catalog.array_agg(
          privilege.privilege_type || ':' || privilege.is_grantable::text
          ORDER BY privilege.privilege_type, privilege.is_grantable
        ),
        ARRAY[]::text[]
      )
      FROM pg_catalog.pg_database AS database
      CROSS JOIN LATERAL pg_catalog.aclexplode(database.datacl) AS privilege
      WHERE database.oid = database_oid
        AND privilege.grantee = operator_role.oid
    ) IS DISTINCT FROM ARRAY['CONNECT:false']::text[]
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_shdepend AS dependency
      WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
        AND dependency.refobjid = operator_role.oid
        AND dependency.dbid IN (0, database_oid)
        AND NOT (
          dependency.classid = 'pg_catalog.pg_database'::pg_catalog.regclass
          AND dependency.objid = database_oid
          AND dependency.deptype = 'a'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = operator_name
        AND parent.rolname <> 'taptime_bootstrap_executor'
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = operator_name
        AND parent.rolname = 'taptime_bootstrap_executor'
        AND (edge.inherit_option OR NOT edge.set_option OR edge.admin_option)
    )
  THEN
    RETURN QUERY SELECT 'operator_not_authorized', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'taptime:c3:bootstrap:request:' || requested_request_id::text,
      0
    )
  );

  SELECT receipt.*
  INTO existing_receipt
  FROM taptime_server.bootstrap_receipts AS receipt
  WHERE receipt.request_id = requested_request_id;

  IF FOUND AND existing_receipt.operator_principal <> operator_name THEN
    INSERT INTO taptime_server.audit_events (
      id,
      organization_id,
      actor_user_id,
      operator_principal,
      event_type,
      entity_type,
      entity_id,
      occurred_at,
      correlation_id,
      payload
    ) VALUES (
      pg_catalog.gen_random_uuid(),
      existing_receipt.organization_id,
      NULL,
      operator_name,
      'BootstrapReplayRejected',
      'BootstrapRequest',
      requested_request_id,
      pg_catalog.transaction_timestamp(),
      requested_request_id::text,
      pg_catalog.jsonb_build_object('reason', 'operator_mismatch')
    );

    RETURN QUERY SELECT
      'operator_replay_forbidden', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF requested_organization_name IS NULL
    OR verified_issuer IS NULL
    OR verified_subject IS NULL
    OR pg_catalog.length(pg_catalog.btrim(verified_issuer)) = 0
    OR pg_catalog.length(pg_catalog.btrim(verified_subject)) = 0
    OR pg_catalog.octet_length(verified_issuer) > 2048
    OR pg_catalog.octet_length(verified_subject) > 2048
    OR pg_catalog.octet_length(requested_organization_name) > 4096
  THEN
    RETURN QUERY SELECT 'invalid_request', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  canonical_organization_name := pg_catalog.normalize(requested_organization_name, 'NFC');
  canonical_organization_name := pg_catalog.btrim(
    canonical_organization_name,
    U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000'
  );

  SELECT COALESCE(pg_catalog.bool_or(
    NOT pg_catalog.unicode_assigned(code_point)
    OR pg_catalog.ascii(code_point) BETWEEN 0 AND 31
    OR pg_catalog.ascii(code_point) BETWEEN 127 AND 159
    OR pg_catalog.ascii(code_point) = 173
    OR pg_catalog.ascii(code_point) BETWEEN 1536 AND 1541
    OR pg_catalog.ascii(code_point) = 1564
    OR pg_catalog.ascii(code_point) = 1757
    OR pg_catalog.ascii(code_point) = 1807
    OR pg_catalog.ascii(code_point) BETWEEN 2192 AND 2193
    OR pg_catalog.ascii(code_point) = 2274
    OR pg_catalog.ascii(code_point) = 6158
    OR pg_catalog.ascii(code_point) BETWEEN 8203 AND 8207
    OR pg_catalog.ascii(code_point) BETWEEN 8234 AND 8238
    OR pg_catalog.ascii(code_point) BETWEEN 8288 AND 8292
    OR pg_catalog.ascii(code_point) BETWEEN 8294 AND 8303
    OR pg_catalog.ascii(code_point) = 65279
    OR pg_catalog.ascii(code_point) BETWEEN 65529 AND 65531
    OR pg_catalog.ascii(code_point) = 69821
    OR pg_catalog.ascii(code_point) = 69837
    OR pg_catalog.ascii(code_point) BETWEEN 78896 AND 78911
    OR pg_catalog.ascii(code_point) BETWEEN 113824 AND 113827
    OR pg_catalog.ascii(code_point) BETWEEN 119155 AND 119162
    OR pg_catalog.ascii(code_point) = 917505
    OR pg_catalog.ascii(code_point) BETWEEN 917536 AND 917631
    OR pg_catalog.ascii(code_point) BETWEEN 55296 AND 57343
    OR pg_catalog.ascii(code_point) BETWEEN 57344 AND 63743
    OR pg_catalog.ascii(code_point) BETWEEN 983040 AND 1048573
    OR pg_catalog.ascii(code_point) BETWEEN 1048576 AND 1114109
    OR pg_catalog.ascii(code_point) IN (8232, 8233)
  ), false)
  INTO invalid_code_point
  FROM pg_catalog.regexp_split_to_table(canonical_organization_name, '') AS code_point;

  IF invalid_code_point
    OR pg_catalog.char_length(canonical_organization_name) NOT BETWEEN 1 AND 120
    OR pg_catalog.octet_length(canonical_organization_name) > 480
  THEN
    RETURN QUERY SELECT 'invalid_request', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  canonical_request_hash := pg_catalog.sha256(
    pg_catalog.convert_to('taptime:c3:v1', 'UTF8')
    || '\x00'::bytea
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to('bootstrapOrganization', 'UTF8')))
    || pg_catalog.convert_to('bootstrapOrganization', 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(canonical_organization_name, 'UTF8')))
    || pg_catalog.convert_to(canonical_organization_name, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_issuer, 'UTF8')))
    || pg_catalog.convert_to(verified_issuer, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_subject, 'UTF8')))
    || pg_catalog.convert_to(verified_subject, 'UTF8')
  );

  IF existing_receipt.request_id IS NOT NULL THEN
    IF existing_receipt.request_hash_version = 1
      AND existing_receipt.request_hash = canonical_request_hash
    THEN
      RETURN QUERY SELECT
        'succeeded',
        true,
        existing_receipt.user_id,
        existing_receipt.identity_binding_id,
        existing_receipt.organization_id,
        existing_receipt.membership_id;
    ELSE
      RETURN QUERY SELECT
        'request_id_conflict', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  identity_lock_hash := pg_catalog.sha256(
    pg_catalog.convert_to('taptime:c3:identity:v1', 'UTF8')
    || '\x00'::bytea
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_issuer, 'UTF8')))
    || pg_catalog.convert_to(verified_issuer, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_subject, 'UTF8')))
    || pg_catalog.convert_to(verified_subject, 'UTF8')
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(identity_lock_hash, 'hex'), 0)
  );

  SELECT binding.*
  INTO existing_binding
  FROM taptime_server.identity_bindings AS binding
  WHERE binding.issuer = verified_issuer
    AND binding.subject = verified_subject;

  IF FOUND THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'taptime:c3:bootstrap:user:' || existing_binding.user_id::text,
        0
      )
    );
    IF existing_binding.revoked_at IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM taptime_server.memberships AS membership
        WHERE membership.user_id = existing_binding.user_id
      )
    THEN
      RETURN QUERY SELECT
        'identity_unavailable', false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;
    bootstrap_user_id := existing_binding.user_id;
    bootstrap_binding_id := existing_binding.id;
    binding_event_type := 'IdentityBindingReused';
  ELSE
    bootstrap_user_id := pg_catalog.gen_random_uuid();
    bootstrap_binding_id := pg_catalog.gen_random_uuid();
    INSERT INTO taptime_server.users (id) VALUES (bootstrap_user_id);
    INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject)
    VALUES (bootstrap_binding_id, bootstrap_user_id, verified_issuer, verified_subject);
    binding_event_type := 'IdentityBindingEstablished';
  END IF;

  bootstrap_organization_id := pg_catalog.gen_random_uuid();
  bootstrap_membership_id := pg_catalog.gen_random_uuid();

  INSERT INTO taptime_server.organizations (id, name)
  VALUES (bootstrap_organization_id, canonical_organization_name);
  INSERT INTO taptime_server.memberships (
    id, organization_id, user_id, role, created_by_user_id
  ) VALUES (
    bootstrap_membership_id,
    bootstrap_organization_id,
    bootstrap_user_id,
    'administrator',
    NULL
  );

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, operator_principal, event_type,
    entity_type, entity_id, occurred_at, correlation_id, payload
  ) VALUES
    (
      pg_catalog.gen_random_uuid(), bootstrap_organization_id, NULL, operator_name,
      binding_event_type, 'IdentityBinding', bootstrap_binding_id,
      pg_catalog.transaction_timestamp(), requested_request_id::text, '{}'::jsonb
    ),
    (
      pg_catalog.gen_random_uuid(), bootstrap_organization_id, NULL, operator_name,
      'OrganizationBootstrapped', 'Organization', bootstrap_organization_id,
      pg_catalog.transaction_timestamp(), requested_request_id::text, '{}'::jsonb
    ),
    (
      pg_catalog.gen_random_uuid(), bootstrap_organization_id, NULL, operator_name,
      'FirstAdministratorMembershipGranted', 'Membership', bootstrap_membership_id,
      pg_catalog.transaction_timestamp(), requested_request_id::text,
      pg_catalog.jsonb_build_object('role', 'administrator')
    );

  INSERT INTO taptime_server.bootstrap_receipts (
    request_id,
    request_hash_version,
    request_hash,
    operator_principal,
    user_id,
    identity_binding_id,
    organization_id,
    membership_id
  ) VALUES (
    requested_request_id,
    1,
    canonical_request_hash,
    operator_name,
    bootstrap_user_id,
    bootstrap_binding_id,
    bootstrap_organization_id,
    bootstrap_membership_id
  );

  RETURN QUERY SELECT
    'succeeded',
    false,
    bootstrap_user_id,
    bootstrap_binding_id,
    bootstrap_organization_id,
    bootstrap_membership_id;
END
$bootstrap$;

ALTER FUNCTION taptime_server.bootstrap_first_organization(uuid, text, text, text)
  OWNER TO taptime_bootstrap_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM taptime_bootstrap_executor;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM taptime_bootstrap_executor;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM taptime_bootstrap_executor;
REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM taptime_bootstrap_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM taptime_bootstrap_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM taptime_bootstrap_function_owner;
REVOKE ALL ON TABLE taptime_server.bootstrap_receipts FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.bootstrap_first_organization(uuid, text, text, text) FROM PUBLIC;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_bootstrap_executor,
  taptime_bootstrap_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.bootstrap_first_organization(uuid, text, text, text)
  TO taptime_bootstrap_executor;
GRANT SELECT, INSERT ON
  taptime_server.users,
  taptime_server.identity_bindings,
  taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.bootstrap_receipts,
  taptime_server.audit_events
TO taptime_bootstrap_function_owner;

COMMENT ON TABLE taptime_server.bootstrap_receipts IS
  'C3B append-only bootstrap idempotency receipts; inaccessible to ordinary runtimes.';
COMMENT ON FUNCTION taptime_server.bootstrap_first_organization(uuid, text, text, text) IS
  'C3B operator-only first Organization/Administrator bootstrap capability.';

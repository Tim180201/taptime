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
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_admin_setup'
  ) THEN
    CREATE ROLE taptime_admin_setup
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_admin_setup_function_owner'
  ) THEN
    CREATE ROLE taptime_admin_setup_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_admin_setup_data_function_owner'
  ) THEN
    CREATE ROLE taptime_admin_setup_data_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_admin_setup WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_admin_setup_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_admin_setup_data_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

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
    'taptime_admin_setup',
    'taptime_admin_setup_function_owner',
    'taptime_admin_setup_data_function_owner'
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
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_db_role_setting AS role_setting
      WHERE role_setting.setrole = role_oid
        AND role_setting.setdatabase IN (0, database_oid)
    ) THEN
      RAISE EXCEPTION 'C3C roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

CREATE FUNCTION taptime_server.normalize_taptime_name_v1(
  requested_name text,
  requested_kind text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $name_contract$
DECLARE
  canonical_name text;
  scalar_maximum integer;
  byte_maximum integer;
  invalid_code_point boolean;
BEGIN
  IF requested_name IS NULL
    OR requested_kind IS NULL
    OR requested_kind NOT IN ('organization', 'customer', 'tag')
    OR pg_catalog.octet_length(requested_name) > 4096
  THEN
    RETURN NULL;
  END IF;

  IF requested_kind IN ('organization', 'customer') THEN
    scalar_maximum := 120;
    byte_maximum := 480;
  ELSE
    scalar_maximum := 80;
    byte_maximum := 320;
  END IF;

  canonical_name := pg_catalog.normalize(requested_name, 'NFC');
  canonical_name := pg_catalog.btrim(
    canonical_name,
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
  FROM pg_catalog.regexp_split_to_table(canonical_name, '') AS code_point;

  IF invalid_code_point
    OR pg_catalog.length(canonical_name) NOT BETWEEN 1 AND scalar_maximum
    OR pg_catalog.octet_length(canonical_name) > byte_maximum
  THEN
    RETURN NULL;
  END IF;
  RETURN canonical_name;
END
$name_contract$;

REVOKE ALL ON FUNCTION taptime_server.normalize_taptime_name_v1(text, text) FROM PUBLIC;

CREATE FUNCTION taptime_server.nfc_validation_fingerprint_v1(canonical_payload text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $fingerprint$
  SELECT pg_catalog.upper(pg_catalog.substr(
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(canonical_payload, 'UTF8')),
      'hex'
    ),
    1,
    12
  ))
$fingerprint$;

REVOKE ALL ON FUNCTION taptime_server.nfc_validation_fingerprint_v1(text) FROM PUBLIC;

ALTER TABLE taptime_server.organizations
  ADD CONSTRAINT organizations_name_v1 CHECK (
    taptime_server.normalize_taptime_name_v1(name, 'organization') IS NOT NULL
    AND name = taptime_server.normalize_taptime_name_v1(name, 'organization')
  );

ALTER TABLE taptime_server.customers
  ADD COLUMN display_name text;
ALTER TABLE taptime_server.nfc_tags
  ADD COLUMN display_name text;

UPDATE taptime_server.customers
SET display_name = 'Customer ' || pg_catalog.upper(
  pg_catalog.substr(pg_catalog.replace(id::text, '-', ''), 1, 12)
);
UPDATE taptime_server.nfc_tags
SET display_name = 'Tag ' || pg_catalog.upper(
  pg_catalog.substr(pg_catalog.replace(id::text, '-', ''), 1, 12)
);

ALTER TABLE taptime_server.customers
  ALTER COLUMN display_name SET NOT NULL,
  ADD CONSTRAINT customers_display_name_v1 CHECK (
    taptime_server.normalize_taptime_name_v1(display_name, 'customer') IS NOT NULL
    AND display_name = taptime_server.normalize_taptime_name_v1(display_name, 'customer')
  );
ALTER TABLE taptime_server.nfc_tags
  ALTER COLUMN display_name SET NOT NULL,
  ADD CONSTRAINT nfc_tags_display_name_v1 CHECK (
    taptime_server.normalize_taptime_name_v1(display_name, 'tag') IS NOT NULL
    AND display_name = taptime_server.normalize_taptime_name_v1(display_name, 'tag')
  ),
  ADD COLUMN validation_fingerprint text GENERATED ALWAYS AS (
    taptime_server.nfc_validation_fingerprint_v1(payload_value)
  ) STORED,
  ADD CONSTRAINT nfc_tags_validation_fingerprint_shape CHECK (
    validation_fingerprint COLLATE "C" ~ '^[0-9A-F]{12}$'
  );

CREATE FUNCTION taptime_server.enforce_admin_setup_nfc_payload()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $payload_guard$
BEGIN
  IF pg_catalog.current_setting('role', true) = 'taptime_admin_setup'
    AND (
      NEW.payload_value IS NULL
      OR NEW.payload_value COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
    )
  THEN
    RAISE EXCEPTION 'Invalid C3C canonical NFC payload' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$payload_guard$;

REVOKE ALL ON FUNCTION taptime_server.enforce_admin_setup_nfc_payload() FROM PUBLIC;

CREATE TRIGGER nfc_tags_admin_setup_payload_guard
  BEFORE INSERT ON taptime_server.nfc_tags
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_admin_setup_nfc_payload();

CREATE TABLE taptime_server.admin_setup_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('createCustomer', 'provisionNfcTag')),
  request_hash_version smallint NOT NULL CHECK (request_hash_version = 1),
  request_hash bytea NOT NULL CHECK (pg_catalog.octet_length(request_hash) = 32),
  result_status text NOT NULL CHECK (result_status = 'succeeded'),
  result_customer_id uuid,
  result_nfc_tag_id uuid,
  result_nfc_assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT admin_setup_receipts_actor_membership_fk FOREIGN KEY (
    organization_id, actor_user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT admin_setup_receipts_customer_fk FOREIGN KEY (
    organization_id, result_customer_id
  ) REFERENCES taptime_server.customers (organization_id, id),
  CONSTRAINT admin_setup_receipts_tag_fk FOREIGN KEY (
    organization_id, result_nfc_tag_id
  ) REFERENCES taptime_server.nfc_tags (organization_id, id),
  CONSTRAINT admin_setup_receipts_assignment_fk FOREIGN KEY (
    organization_id, result_nfc_assignment_id
  ) REFERENCES taptime_server.nfc_assignments (organization_id, id),
  CONSTRAINT admin_setup_receipts_result_shape CHECK (
    (
      command_type = 'createCustomer'
      AND result_customer_id IS NOT NULL
      AND result_nfc_tag_id IS NULL
      AND result_nfc_assignment_id IS NULL
    )
    OR (
      command_type = 'provisionNfcTag'
      AND result_customer_id IS NULL
      AND result_nfc_tag_id IS NOT NULL
      AND result_nfc_assignment_id IS NOT NULL
    )
  )
);

ALTER TABLE taptime_server.admin_setup_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.admin_setup_command_receipts FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.has_current_admin_setup_authority(
  requested_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
    AND EXISTS (
      SELECT 1
      FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.role = 'administrator'
        AND membership.revoked_at IS NULL
    )
$authority$;

CREATE FUNCTION taptime_server.admin_create_customer_digest_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  canonical_display_name text
)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest_contract$
DECLARE
  framed bytea := pg_catalog.convert_to('taptime:c3:v1', 'UTF8') || pg_catalog.decode('00', 'hex');
  field text;
  encoded bytea;
BEGIN
  IF requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_membership_id IS NULL
    OR canonical_display_name IS NULL
    OR taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'customer'
    ) IS NULL
    OR canonical_display_name IS DISTINCT FROM taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'customer'
    )
  THEN
    RAISE EXCEPTION 'Invalid canonical Customer display name' USING ERRCODE = '22023';
  END IF;

  FOREACH field IN ARRAY ARRAY[
    'createCustomer',
    requested_organization_id::text,
    requested_actor_user_id::text,
    requested_membership_id::text,
    canonical_display_name
  ]
  LOOP
    encoded := pg_catalog.convert_to(field, 'UTF8');
    framed := framed || pg_catalog.int4send(pg_catalog.octet_length(encoded)) || encoded;
  END LOOP;
  RETURN pg_catalog.sha256(framed);
END
$digest_contract$;

CREATE FUNCTION taptime_server.admin_provision_nfc_tag_digest_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_customer_id uuid,
  canonical_display_name text,
  canonical_payload text
)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest_contract$
DECLARE
  framed bytea := pg_catalog.convert_to('taptime:c3:v1', 'UTF8') || pg_catalog.decode('00', 'hex');
  field text;
  encoded bytea;
BEGIN
  IF requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_membership_id IS NULL
    OR requested_customer_id IS NULL
    OR canonical_display_name IS NULL
    OR taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    ) IS NULL
    OR canonical_display_name IS DISTINCT FROM taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    )
    OR canonical_payload IS NULL
    OR canonical_payload COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
  THEN
    RAISE EXCEPTION 'Invalid canonical Tag command data' USING ERRCODE = '22023';
  END IF;

  FOREACH field IN ARRAY ARRAY[
    'provisionNfcTag',
    requested_organization_id::text,
    requested_actor_user_id::text,
    requested_membership_id::text,
    requested_customer_id::text,
    canonical_display_name,
    canonical_payload
  ]
  LOOP
    encoded := pg_catalog.convert_to(field, 'UTF8');
    framed := framed || pg_catalog.int4send(pg_catalog.octet_length(encoded)) || encoded;
  END LOOP;
  RETURN pg_catalog.sha256(framed);
END
$digest_contract$;

CREATE FUNCTION taptime_server.enforce_admin_setup_receipt_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $receipt_integrity$
DECLARE
  expected_request_hash bytea;
  stored_display_name text;
  stored_payload text;
  stored_customer_id uuid;
  audit_total bigint;
  customer_audit_total bigint;
  tag_audit_total bigint;
  assignment_audit_total bigint;
BEGIN
  IF NEW.organization_id IS NULL
    OR NEW.actor_user_id IS NULL
    OR NEW.membership_id IS NULL
    OR NEW.request_hash_version IS DISTINCT FROM 1
    OR NEW.request_hash IS NULL
    OR pg_catalog.octet_length(NEW.request_hash) <> 32
    OR NEW.result_status IS DISTINCT FROM 'succeeded'
  THEN
    RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  IF NEW.command_type = 'createCustomer'
    AND NEW.result_customer_id IS NOT NULL
    AND NEW.result_nfc_tag_id IS NULL
    AND NEW.result_nfc_assignment_id IS NULL
  THEN
    SELECT customer.display_name
    INTO stored_display_name
    FROM taptime_server.customers AS customer
    WHERE customer.organization_id = NEW.organization_id
      AND customer.id = NEW.result_customer_id
      AND customer.active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
    expected_request_hash := taptime_server.admin_create_customer_digest_v1(
      NEW.organization_id,
      NEW.actor_user_id,
      NEW.membership_id,
      stored_display_name
    );
    SELECT
      pg_catalog.count(*),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'CustomerCreated'
        AND audit.entity_type = 'Customer'
        AND audit.entity_id = NEW.result_customer_id
        AND audit.payload = '{}'::jsonb
      )
    INTO audit_total, customer_audit_total
    FROM taptime_server.audit_events AS audit
    WHERE audit.organization_id = NEW.organization_id
      AND audit.correlation_id = NEW.command_id::text;
    IF audit_total <> 1 OR customer_audit_total <> 1 THEN
      RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.command_type = 'provisionNfcTag'
    AND NEW.result_customer_id IS NULL
    AND NEW.result_nfc_tag_id IS NOT NULL
    AND NEW.result_nfc_assignment_id IS NOT NULL
  THEN
    SELECT tag.display_name, tag.payload_value, assignment.target_customer_id
    INTO stored_display_name, stored_payload, stored_customer_id
    FROM taptime_server.nfc_tags AS tag
    INNER JOIN taptime_server.nfc_assignments AS assignment
      ON assignment.organization_id = tag.organization_id
     AND assignment.id = NEW.result_nfc_assignment_id
     AND assignment.nfc_tag_id = tag.id
     AND assignment.target_type = 'customer'
     AND assignment.active
    INNER JOIN taptime_server.customers AS customer
      ON customer.organization_id = assignment.organization_id
     AND customer.id = assignment.target_customer_id
     AND customer.active
    WHERE tag.organization_id = NEW.organization_id
      AND tag.id = NEW.result_nfc_tag_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
    expected_request_hash := taptime_server.admin_provision_nfc_tag_digest_v1(
      NEW.organization_id,
      NEW.actor_user_id,
      NEW.membership_id,
      stored_customer_id,
      stored_display_name,
      stored_payload
    );
    SELECT
      pg_catalog.count(*),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'NfcTagRegistered'
        AND audit.entity_type = 'NfcTag'
        AND audit.entity_id = NEW.result_nfc_tag_id
        AND audit.payload = '{}'::jsonb
      ),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'NfcTagAssigned'
        AND audit.entity_type = 'NfcAssignment'
        AND audit.entity_id = NEW.result_nfc_assignment_id
        AND audit.payload = '{}'::jsonb
      )
    INTO audit_total, tag_audit_total, assignment_audit_total
    FROM taptime_server.audit_events AS audit
    WHERE audit.organization_id = NEW.organization_id
      AND audit.correlation_id = NEW.command_id::text;
    IF audit_total <> 2 OR tag_audit_total <> 1 OR assignment_audit_total <> 1 THEN
      RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  IF NEW.request_hash IS DISTINCT FROM expected_request_hash THEN
    RAISE EXCEPTION 'C3C receipt integrity rejected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$receipt_integrity$;

REVOKE ALL ON FUNCTION taptime_server.enforce_admin_setup_receipt_integrity() FROM PUBLIC;

CREATE TRIGGER admin_setup_receipts_integrity_guard
  AFTER INSERT ON taptime_server.admin_setup_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_admin_setup_receipt_integrity();

CREATE FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(
  requested_id uuid,
  requested_organization_id uuid,
  canonical_display_name text,
  canonical_payload text
)
RETURNS TABLE (
  inserted_nfc_tag_id uuid,
  validation_fingerprint text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $tag_insert$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup'
    OR requested_id IS NULL
    OR NOT taptime_server.has_current_admin_setup_authority(requested_organization_id)
    OR canonical_display_name IS NULL
    OR taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    ) IS NULL
    OR canonical_display_name IS DISTINCT FROM taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    )
    OR canonical_payload IS NULL
    OR canonical_payload COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
  THEN
    RAISE EXCEPTION 'C3C Tag insert capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO taptime_server.nfc_tags AS inserted_tag (
    id,
    organization_id,
    display_name,
    payload_value
  ) VALUES (
    requested_id,
    requested_organization_id,
    canonical_display_name,
    canonical_payload
  )
  ON CONFLICT ON CONSTRAINT nfc_tags_organization_payload_unique DO NOTHING
  RETURNING inserted_tag.id, inserted_tag.validation_fingerprint;
END
$tag_insert$;

CREATE FUNCTION taptime_server.lock_admin_setup_active_customer_v1(
  requested_organization_id uuid,
  requested_customer_id uuid
)
RETURNS TABLE (locked_customer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $customer_lock$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup'
    OR requested_customer_id IS NULL
    OR NOT taptime_server.has_current_admin_setup_authority(requested_organization_id)
  THEN
    RAISE EXCEPTION 'C3C Customer lock capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT customer.id
  FROM taptime_server.customers AS customer
  WHERE customer.organization_id = requested_organization_id
    AND customer.id = requested_customer_id
    AND customer.active
  FOR SHARE;
END
$customer_lock$;

REVOKE ALL ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.admin_create_customer_digest_v1(uuid, uuid, uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.admin_provision_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(
  uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.lock_admin_setup_active_customer_v1(uuid, uuid)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION taptime_server.append_administrative_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $audit$
DECLARE
  audit_organization_id uuid;
  audit_entity_id uuid;
  audit_event_type text;
  audit_entity_type text;
  audit_payload jsonb;
  audit_correlation_id text;
  selected_role text := current_setting('role', true);
BEGIN
  IF selected_role NOT IN ('taptime_administrator', 'taptime_admin_setup') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF selected_role = 'taptime_admin_setup' AND NOT (
    TG_OP = 'INSERT'
    AND TG_TABLE_NAME IN ('customers', 'nfc_tags', 'nfc_assignments')
  ) THEN
    RAISE EXCEPTION 'Setup operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'organizations' THEN
    audit_organization_id := NEW.id;
  ELSE
    audit_organization_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.organization_id
      ELSE NEW.organization_id
    END;
  END IF;
  audit_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  audit_correlation_id := NULLIF(current_setting('app.correlation_id', true), '');
  IF audit_correlation_id IS NULL THEN
    RAISE EXCEPTION 'Administrative audit correlation context is required' USING ERRCODE = '42501';
  END IF;
  IF selected_role = 'taptime_admin_setup'
    AND audit_correlation_id COLLATE "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'Setup audit correlation must be a canonical UUID' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'organizations' AND TG_OP = 'UPDATE' THEN
    audit_event_type := 'OrganizationUpdated';
    audit_entity_type := 'Organization';
    audit_payload := jsonb_build_object(
      'changedFields', jsonb_build_array('name'),
      'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT' THEN
    audit_event_type := 'MembershipGranted';
    audit_entity_type := 'Membership';
    audit_payload := jsonb_build_object('role', NEW.role);
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'UPDATE' THEN
    audit_event_type := CASE
      WHEN NEW.revoked_at IS NOT NULL THEN 'MembershipRevoked'
      ELSE 'MembershipRoleChanged'
    END;
    audit_entity_type := 'Membership';
    audit_payload := jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'customers' THEN
    audit_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'CustomerCreated'
      WHEN 'UPDATE' THEN 'CustomerDeactivated'
      WHEN 'DELETE' THEN 'CustomerDeleted'
    END;
    audit_entity_type := 'Customer';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb
    END;
  ELSIF TG_TABLE_NAME = 'nfc_tags' THEN
    audit_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'NfcTagRegistered' ELSE 'NfcTagDeleted' END;
    audit_entity_type := 'NfcTag';
    audit_payload := '{}'::jsonb;
  ELSIF TG_TABLE_NAME = 'nfc_assignments' THEN
    audit_event_type := CASE
      WHEN TG_OP = 'INSERT' THEN 'NfcTagAssigned'
      ELSE 'NfcAssignmentDeactivated'
    END;
    audit_entity_type := 'NfcAssignment';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb
    END;
  ELSE
    RAISE EXCEPTION 'Administrative operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;

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
    audit_organization_id,
    taptime_server.current_user_id(),
    NULL,
    audit_event_type,
    audit_entity_type,
    audit_entity_id,
    transaction_timestamp(),
    audit_correlation_id,
    audit_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$audit$;

ALTER FUNCTION taptime_server.has_current_admin_setup_authority(uuid)
  OWNER TO taptime_admin_setup_function_owner;
ALTER FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(uuid, uuid, text, text)
  OWNER TO taptime_admin_setup_data_function_owner;
ALTER FUNCTION taptime_server.lock_admin_setup_active_customer_v1(uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
ALTER FUNCTION taptime_server.enforce_admin_setup_receipt_integrity()
  OWNER TO taptime_admin_setup_data_function_owner;
ALTER FUNCTION taptime_server.append_administrative_audit_event()
  OWNER TO taptime_admin_setup_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM taptime_admin_setup;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM taptime_admin_setup;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM taptime_admin_setup;
REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM taptime_admin_setup_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM taptime_admin_setup_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM taptime_admin_setup_function_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server
  FROM taptime_admin_setup_data_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server
  FROM taptime_admin_setup_data_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server
  FROM taptime_admin_setup_data_function_owner;
REVOKE ALL ON SCHEMA taptime_server FROM
  taptime_admin_setup,
  taptime_admin_setup_function_owner,
  taptime_admin_setup_data_function_owner;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_admin_setup,
  taptime_admin_setup_function_owner,
  taptime_admin_setup_data_function_owner;
GRANT SELECT ON taptime_server.memberships TO taptime_admin_setup_function_owner;
GRANT INSERT ON taptime_server.audit_events TO taptime_admin_setup_function_owner;
GRANT INSERT (id, organization_id, display_name, payload_value)
  ON taptime_server.nfc_tags TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, display_name, payload_value, validation_fingerprint)
  ON taptime_server.nfc_tags TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, display_name, active)
  ON taptime_server.customers TO taptime_admin_setup_data_function_owner;
GRANT UPDATE (active)
  ON taptime_server.customers TO taptime_admin_setup_data_function_owner;
GRANT SELECT (
  id, organization_id, nfc_tag_id, target_type, target_customer_id, active
) ON taptime_server.nfc_assignments TO taptime_admin_setup_data_function_owner;
GRANT SELECT (
  organization_id, actor_user_id, operator_principal, event_type, entity_type,
  entity_id, correlation_id, payload
) ON taptime_server.audit_events TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id()
  TO taptime_admin_setup_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid)
  TO taptime_admin_setup_function_owner, taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.nfc_validation_fingerprint_v1(text)
  TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.admin_create_customer_digest_v1(
  uuid, uuid, uuid, text
) TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.admin_provision_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, text, text
) TO taptime_admin_setup_data_function_owner;

GRANT EXECUTE ON FUNCTION taptime_server.current_organization_id() TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id() TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid)
  TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_admin_setup, taptime_administrator, taptime_bootstrap_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.nfc_validation_fingerprint_v1(text)
  TO taptime_admin_setup, taptime_administrator;
GRANT EXECUTE ON FUNCTION taptime_server.admin_create_customer_digest_v1(
  uuid, uuid, uuid, text
) TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.admin_provision_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, text, text
) TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(
  uuid, uuid, text, text
) TO taptime_admin_setup;
GRANT EXECUTE ON FUNCTION taptime_server.lock_admin_setup_active_customer_v1(uuid, uuid)
  TO taptime_admin_setup;

GRANT SELECT (id, name) ON taptime_server.organizations TO taptime_admin_setup;
GRANT SELECT (id, organization_id, display_name, active, created_at)
  ON taptime_server.customers TO taptime_admin_setup;
GRANT INSERT (id, organization_id, display_name, active)
  ON taptime_server.customers TO taptime_admin_setup;
GRANT SELECT (id, organization_id, display_name, validation_fingerprint, created_at)
  ON taptime_server.nfc_tags TO taptime_admin_setup;
GRANT SELECT (
  id, organization_id, nfc_tag_id, target_type, target_customer_id, active, created_at
) ON taptime_server.nfc_assignments TO taptime_admin_setup;
GRANT INSERT (
  id, organization_id, nfc_tag_id, target_type, target_customer_id, active
) ON taptime_server.nfc_assignments TO taptime_admin_setup;
GRANT SELECT, INSERT ON taptime_server.admin_setup_command_receipts TO taptime_admin_setup;

GRANT INSERT (display_name) ON taptime_server.customers TO taptime_administrator;
GRANT INSERT (display_name) ON taptime_server.nfc_tags TO taptime_administrator;

CREATE POLICY organizations_admin_setup_select ON taptime_server.organizations
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(id));

CREATE POLICY customers_admin_setup_select ON taptime_server.customers
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY customers_admin_setup_insert ON taptime_server.customers
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));

CREATE POLICY nfc_tags_admin_setup_select ON taptime_server.nfc_tags
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY nfc_tags_admin_setup_insert ON taptime_server.nfc_tags
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));

CREATE POLICY nfc_assignments_admin_setup_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY nfc_assignments_admin_setup_insert ON taptime_server.nfc_assignments
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));

CREATE POLICY admin_setup_receipts_select ON taptime_server.admin_setup_command_receipts
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY admin_setup_receipts_insert ON taptime_server.admin_setup_command_receipts
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (
    taptime_server.has_current_admin_setup_authority(organization_id)
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND command_id = NULLIF(
      pg_catalog.current_setting('app.correlation_id', true), ''
    )::uuid
  );

REVOKE ALL ON TABLE taptime_server.admin_setup_command_receipts FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.admin_create_customer_digest_v1(uuid, uuid, uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.admin_provision_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(
  uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.lock_admin_setup_active_customer_v1(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.enforce_admin_setup_receipt_integrity() FROM PUBLIC;

COMMENT ON TABLE taptime_server.admin_setup_command_receipts IS
  'C3C append-only success receipts; no raw request, name, identity claim or NFC payload.';
COMMENT ON COLUMN taptime_server.nfc_tags.validation_fingerprint IS
  'Display-only first 12 uppercase SHA-256 hex characters; never identity or authority.';

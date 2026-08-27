-- T-015b: Location Managers may manage Employee Memberships only inside their current,
-- explicit Management Location scope. Organization authority and Location scope are returned
-- by one function so callers can both authorize mutations and truthfully filter projections.

ALTER TABLE taptime_server.memberships
  DROP CONSTRAINT memberships_role_check,
  ADD CONSTRAINT memberships_role_v2
    CHECK (role IN ('administrator', 'standortleitung', 'employee'));

ALTER TABLE taptime_server.offline_capture_leases
  DROP CONSTRAINT offline_capture_leases_membership_role_check,
  ADD CONSTRAINT offline_capture_leases_membership_role_v2
    CHECK (membership_role IN ('administrator', 'standortleitung', 'employee'));

ALTER TABLE taptime_server.employee_membership_invitations
  DROP CONSTRAINT employee_invitations_membership_role_v1,
  ADD CONSTRAINT employee_invitations_membership_role_v2
    CHECK (membership_role IN ('administrator', 'standortleitung', 'employee')),
  ADD COLUMN home_location_id uuid,
  ADD CONSTRAINT employee_invitations_home_location_fk FOREIGN KEY (
    organization_id, home_location_id
  ) REFERENCES taptime_server.locations (organization_id, id);

ALTER TABLE taptime_server.membership_management_command_receipts
  DROP CONSTRAINT membership_management_command_receipts_requested_role_check,
  DROP CONSTRAINT membership_management_command_receipts_result_role_check,
  ADD CONSTRAINT membership_management_receipts_requested_role_v2
    CHECK (requested_role IN ('administrator', 'standortleitung', 'employee')),
  ADD CONSTRAINT membership_management_receipts_result_role_v2
    CHECK (result_role IN ('administrator', 'standortleitung', 'employee'));

ALTER TABLE taptime_server.employee_invitation_command_receipts
  DROP CONSTRAINT employee_invitation_command_receipts_request_hash_version_check,
  ADD CONSTRAINT employee_invitation_receipts_request_hash_version_v2
    CHECK (request_hash_version IN (1, 2));

-- A Location Manager remains a mobile self user. Management Locations do not widen that
-- capability: own time remains user-bound, and work targets follow only the Membership's
-- current Home or additional Work Locations when Locations are enabled.
CREATE OR REPLACE FUNCTION taptime_server.has_current_mobile_self_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND requested_user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND requested_membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true)
      IN ('employee', 'standortleitung', 'administrator')
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = requested_user_id
        AND membership.id = requested_membership_id
        AND membership.role IN ('employee', 'standortleitung', 'administrator')
        AND membership.revoked_at IS NULL
    )
$authority$;

CREATE OR REPLACE FUNCTION taptime_server.read_mobile_work_targets_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid,
  requested_after_type_rank integer,
  requested_after_display_name text,
  requested_after_target_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  target_type text,
  target_id uuid,
  display_name text,
  row_version bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $targets$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_mobile_target_reader'
    OR NOT taptime_server.has_current_mobile_self_v1(
      requested_organization_id, requested_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type_rank IS NULL)
       <> (requested_after_display_name IS NULL OR requested_after_target_id IS NULL)
  THEN
    RAISE EXCEPTION 'Mobile target capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.display_name, target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
    AND (
      NOT EXISTS (
        SELECT 1
        FROM taptime_server.organizations AS organization
        WHERE organization.id = requested_organization_id
          AND organization.locations_enabled
      )
      OR EXISTS (
        SELECT 1
        FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id = target.organization_id
          AND binding.target_type = target.target_type
          AND binding.target_id = target.target_id
          AND binding.revoked_at IS NULL
          AND taptime_server.membership_has_work_location_v1(
            requested_organization_id, requested_membership_id, binding.location_id
          )
      )
    )
    AND (
      requested_after_type_rank IS NULL
      OR (
        CASE target.target_type
          WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3
        END,
        target.display_name COLLATE "C",
        target.target_id
      ) > (
        requested_after_type_rank,
        requested_after_display_name COLLATE "C",
        requested_after_target_id
      )
    )
  ORDER BY
    CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,
    target.display_name COLLATE "C",
    target.target_id
  LIMIT requested_limit;
END
$targets$;

ALTER FUNCTION taptime_server.has_current_mobile_self_v1(uuid, uuid, uuid)
  OWNER TO taptime_mobile_read_function_owner;
ALTER FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_mobile_self_v1(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) TO taptime_mobile_target_reader;
GRANT SELECT (id, locations_enabled)
  ON taptime_server.organizations TO taptime_mobile_read_function_owner;
GRANT SELECT (organization_id, target_type, target_id, location_id, revoked_at)
  ON taptime_server.work_target_location_assignments TO taptime_mobile_read_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.membership_has_work_location_v1(uuid, uuid, uuid)
  TO taptime_mobile_read_function_owner;

CREATE FUNCTION taptime_server.membership_invitation_request_digest_v3(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  canonical_display_name text,
  requested_membership_role text,
  requested_home_location_id uuid
)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest$
  SELECT pg_catalog.sha256(
    pg_catalog.convert_to('taptime:t015b:membership-invitation:v3', 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_organization_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_actor_user_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_membership_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(canonical_display_name, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_membership_role, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_home_location_id::text, 'UTF8')
  )
$digest$;

REVOKE ALL ON FUNCTION taptime_server.membership_invitation_request_digest_v3(
  uuid, uuid, uuid, text, text, uuid
) FROM PUBLIC;

DROP FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text
);

CREATE FUNCTION taptime_server.has_membership_management_authority_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_actor_membership_id uuid,
  requested_action text,
  requested_target_membership_id uuid,
  requested_membership_role text,
  requested_location_id uuid
)
RETURNS TABLE (scope_kind text, location_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  WITH actor AS MATERIALIZED (
    SELECT organization.locations_enabled, membership.role
    FROM taptime_server.organizations AS organization
    JOIN taptime_server.memberships AS membership
      ON membership.organization_id = organization.id
     AND membership.user_id = requested_actor_user_id
     AND membership.id = requested_actor_membership_id
     AND membership.revoked_at IS NULL
    WHERE organization.id = requested_organization_id
      AND requested_organization_id IS NOT NULL
      AND requested_actor_user_id IS NOT NULL
      AND requested_actor_membership_id IS NOT NULL
  ),
  organization_scope AS (
    SELECT 'organization'::text AS scope_kind, NULL::uuid AS location_id
    FROM actor
    WHERE actor.role = 'administrator'
      AND CASE requested_action
        WHEN 'read' THEN
          requested_target_membership_id IS NULL
          AND requested_membership_role IS NULL
          AND requested_location_id IS NULL
        WHEN 'invite' THEN
          requested_target_membership_id IS NULL
          AND requested_membership_role IN ('administrator', 'standortleitung', 'employee')
          AND (
            (NOT actor.locations_enabled AND requested_location_id IS NULL)
            OR (
              actor.locations_enabled
              AND EXISTS (
                SELECT 1
                FROM taptime_server.locations AS location
                WHERE location.organization_id = requested_organization_id
                  AND location.id = requested_location_id
                  AND location.active
              )
            )
          )
        WHEN 'revoke' THEN
          requested_target_membership_id IS NOT NULL
          AND requested_membership_role IS NULL
          AND requested_location_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS target
            WHERE target.organization_id = requested_organization_id
              AND target.id = requested_target_membership_id
              AND target.revoked_at IS NULL
          )
        WHEN 'change_role' THEN
          requested_target_membership_id IS NOT NULL
          AND requested_membership_role IN ('administrator', 'standortleitung', 'employee')
          AND requested_location_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS target
            WHERE target.organization_id = requested_organization_id
              AND target.id = requested_target_membership_id
              AND target.revoked_at IS NULL
          )
        ELSE false
      END
  ),
  location_scope AS (
    SELECT 'location'::text AS scope_kind, management_grant.location_id
    FROM actor
    JOIN taptime_server.membership_management_location_grants AS management_grant
      ON management_grant.organization_id = requested_organization_id
     AND management_grant.membership_id = requested_actor_membership_id
     AND management_grant.revoked_at IS NULL
    JOIN taptime_server.locations AS location
      ON location.organization_id = management_grant.organization_id
     AND location.id = management_grant.location_id
     AND location.active
    WHERE actor.role = 'standortleitung'
      AND actor.locations_enabled
      AND CASE requested_action
        WHEN 'read' THEN
          requested_target_membership_id IS NULL
          AND requested_membership_role IS NULL
          AND requested_location_id IS NULL
        WHEN 'invite' THEN
          requested_target_membership_id IS NULL
          AND requested_membership_role = 'employee'
          AND requested_location_id = management_grant.location_id
        WHEN 'revoke' THEN
          requested_target_membership_id IS NOT NULL
          AND requested_membership_role IS NULL
          AND requested_location_id IS NULL
          AND requested_target_membership_id <> requested_actor_membership_id
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS target
            JOIN taptime_server.membership_home_location_assignments AS home
              ON home.organization_id = target.organization_id
             AND home.membership_id = target.id
             AND home.location_id = management_grant.location_id
             AND home.revoked_at IS NULL
            WHERE target.organization_id = requested_organization_id
              AND target.id = requested_target_membership_id
              AND target.role = 'employee'
              AND target.revoked_at IS NULL
          )
        ELSE false
      END
  )
  SELECT organization_scope.scope_kind, organization_scope.location_id
  FROM organization_scope
  UNION ALL
  SELECT location_scope.scope_kind, location_scope.location_id
  FROM location_scope
$authority$;

ALTER FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text, uuid
) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text, uuid
) FROM PUBLIC;

CREATE FUNCTION taptime_server.create_membership_invitation_v3(
  requested_command_id uuid,
  requested_invitation_id uuid,
  requested_display_name text,
  requested_membership_role text,
  requested_home_location_id uuid,
  requested_token_digest bytea
)
RETURNS TABLE (result_status text, result_expires_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $create$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  canonical_name text;
  request_hash bytea;
  request_hash_version smallint;
  existing_receipt taptime_server.employee_invitation_command_receipts%ROWTYPE;
  invitation_expiry timestamptz;
  active_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_invitation_id IS NULL
    OR requested_membership_role NOT IN ('administrator', 'standortleitung', 'employee')
    OR requested_token_digest IS NULL
    OR pg_catalog.octet_length(requested_token_digest) <> 32
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '')
       <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;
  canonical_name := taptime_server.normalize_membership_display_name_v1(
    requested_display_name
  );
  IF canonical_name IS NULL OR canonical_name <> requested_display_name THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'invite', NULL, requested_membership_role, requested_home_location_id
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-invitation-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  IF requested_home_location_id IS NULL THEN
    request_hash_version := 1;
    request_hash := taptime_server.membership_invitation_request_digest_v2(
      context_organization_id, context_user_id, context_membership_id,
      canonical_name, requested_membership_role
    );
  ELSE
    request_hash_version := 2;
    request_hash := taptime_server.membership_invitation_request_digest_v3(
      context_organization_id, context_user_id, context_membership_id,
      canonical_name, requested_membership_role, requested_home_location_id
    );
  END IF;
  SELECT receipt.* INTO existing_receipt
  FROM taptime_server.employee_invitation_command_receipts AS receipt
  WHERE receipt.organization_id = context_organization_id
    AND receipt.command_id = requested_command_id;
  IF FOUND THEN
    IF existing_receipt.actor_user_id = context_user_id
      AND existing_receipt.membership_id = context_membership_id
      AND existing_receipt.request_hash_version = request_hash_version
      AND existing_receipt.request_hash = request_hash
    THEN
      RETURN QUERY SELECT 'invitation_created_token_unavailable', existing_receipt.expires_at;
    ELSE
      RETURN QUERY SELECT 'command_id_conflict', NULL::timestamptz;
    END IF;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-invitation-cap:' || context_organization_id::text, 0
  ));
  SELECT pg_catalog.count(*)::integer INTO active_count
  FROM taptime_server.employee_membership_invitations AS invitation
  WHERE invitation.organization_id = context_organization_id
    AND invitation.consumed_at IS NULL
    AND invitation.expires_at > pg_catalog.transaction_timestamp();
  IF active_count >= 5 THEN
    RETURN QUERY SELECT 'invitation_limit_reached', NULL::timestamptz;
    RETURN;
  END IF;

  invitation_expiry := pg_catalog.transaction_timestamp() + interval '15 minutes';
  INSERT INTO taptime_server.employee_membership_invitations (
    id, organization_id, creator_user_id, creator_membership_id, display_name,
    membership_role, home_location_id, token_digest, expires_at
  ) VALUES (
    requested_invitation_id, context_organization_id, context_user_id,
    context_membership_id, canonical_name, requested_membership_role,
    requested_home_location_id, requested_token_digest, invitation_expiry
  );
  INSERT INTO taptime_server.employee_invitation_command_receipts (
    organization_id, command_id, actor_user_id, membership_id, request_hash_version,
    request_hash, invitation_id, expires_at
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, request_hash_version, request_hash,
    requested_invitation_id, invitation_expiry
  );
  RETURN QUERY SELECT 'succeeded', invitation_expiry;
END
$create$;

CREATE OR REPLACE FUNCTION taptime_server.create_membership_invitation_v2(
  requested_command_id uuid,
  requested_invitation_id uuid,
  requested_display_name text,
  requested_membership_role text,
  requested_token_digest bytea
)
RETURNS TABLE (result_status text, result_expires_at timestamptz)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $compatibility$
  SELECT result.result_status, result.result_expires_at
  FROM taptime_server.create_membership_invitation_v3(
    requested_command_id, requested_invitation_id, requested_display_name,
    requested_membership_role, NULL, requested_token_digest
  ) AS result
$compatibility$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_memberships_v1(
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text,
  membership_role text,
  membership_active boolean,
  membership_row_version bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $projection$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_limit NOT BETWEEN 1 AND 20
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH management_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    ) AS authority
  )
  SELECT organization.id, organization.name, page.id,
         COALESCE(
           page.display_name,
           CASE page.role
             WHEN 'administrator' THEN 'Administrator'
             WHEN 'standortleitung' THEN 'Standortleitung'
             ELSE 'Beschäftigter'
           END
         ),
         page.role, page.revoked_at IS NULL, page.row_version
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = organization.id
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
      AND (
        EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'organization' AND scope.location_id IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM taptime_server.membership_home_location_assignments AS home
          JOIN management_scope AS scope
            ON scope.scope_kind = 'location'
           AND scope.location_id = home.location_id
          WHERE home.organization_id = membership.organization_id
            AND home.membership_id = membership.id
            AND home.revoked_at IS NULL
        )
      )
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope);
END
$projection$;

CREATE OR REPLACE FUNCTION taptime_server.manage_membership_v1(
  requested_command_id uuid,
  requested_target_membership_id uuid,
  requested_expected_row_version bigint,
  requested_command_type text,
  requested_membership_role text
)
RETURNS TABLE (
  result_status text,
  result_role text,
  result_active boolean,
  result_row_version bigint,
  result_idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $manage$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  target taptime_server.memberships%ROWTYPE;
  receipt taptime_server.membership_management_command_receipts%ROWTYPE;
  administrator_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_target_membership_id IS NULL
    OR requested_expected_row_version IS NULL OR requested_expected_row_version < 1
    OR requested_command_type NOT IN ('revoke', 'change_role')
    OR (requested_command_type = 'revoke' AND requested_membership_role IS NOT NULL)
    OR (requested_command_type = 'change_role'
      AND requested_membership_role NOT IN ('administrator', 'standortleitung', 'employee'))
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '')
       <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  SELECT stored.* INTO receipt
  FROM taptime_server.membership_management_command_receipts AS stored
  WHERE stored.organization_id = context_organization_id
    AND stored.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_user_id = context_user_id
      AND receipt.actor_membership_id = context_membership_id
      AND receipt.target_membership_id = requested_target_membership_id
      AND receipt.command_type = requested_command_type
      AND receipt.requested_role IS NOT DISTINCT FROM requested_membership_role
      AND receipt.expected_row_version = requested_expected_row_version
    THEN
      RETURN QUERY SELECT 'succeeded', receipt.result_role,
        receipt.result_revoked_at IS NULL, receipt.result_row_version, true;
    ELSE
      RETURN QUERY SELECT 'command_id_conflict', NULL::text, NULL::boolean,
        NULL::bigint, false;
    END IF;
    RETURN;
  END IF;

  SELECT membership.* INTO target
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = context_organization_id
    AND membership.id = requested_target_membership_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'target_unavailable', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'revoke'
    AND target.id = context_membership_id
  THEN
    RETURN QUERY SELECT 'self_revocation_forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      requested_command_type, requested_target_membership_id,
      requested_membership_role, NULL
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF target.row_version <> requested_expected_row_version THEN
    RETURN QUERY SELECT 'stale_row_version', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'change_role'
    AND target.role = requested_membership_role
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  IF target.role = 'administrator'
    AND (
      requested_command_type = 'revoke'
      OR (
        requested_command_type = 'change_role'
        AND requested_membership_role <> 'administrator'
      )
    )
  THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'taptime:t009:last-administrator:' || context_organization_id::text, 0
    ));
    SELECT pg_catalog.count(*)::integer INTO administrator_count
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = context_organization_id
      AND membership.role = 'administrator'
      AND membership.revoked_at IS NULL;
    IF administrator_count <= 1 THEN
      RETURN QUERY SELECT 'last_administrator', NULL::text, NULL::boolean,
        NULL::bigint, false;
      RETURN;
    END IF;
  END IF;

  IF requested_command_type = 'revoke' THEN
    UPDATE taptime_server.memberships
    SET revoked_at = pg_catalog.transaction_timestamp(), row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  ELSIF target.role <> requested_membership_role THEN
    UPDATE taptime_server.memberships
    SET role = requested_membership_role, row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  END IF;

  INSERT INTO taptime_server.membership_management_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    target_membership_id, command_type, requested_role, expected_row_version,
    result_role, result_revoked_at, result_row_version
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, target.id, requested_command_type,
    requested_membership_role, requested_expected_row_version,
    target.role, target.revoked_at, target.row_version
  );
  RETURN QUERY SELECT 'succeeded', target.role, target.revoked_at IS NULL,
    target.row_version, false;
END
$manage$;

CREATE OR REPLACE FUNCTION taptime_server.enforce_employee_invitation_consumption_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  IF TG_OP = 'DELETE'
    OR pg_catalog.current_setting('role', true) NOT IN (
      'taptime_employee_enrollment_redeemer',
      'taptime_membership_enrollment_redeemer'
    )
    OR OLD.consumed_at IS NOT NULL
    OR NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.creator_user_id <> OLD.creator_user_id
    OR NEW.creator_membership_id <> OLD.creator_membership_id
    OR NEW.display_name <> OLD.display_name
    OR NEW.membership_role <> OLD.membership_role
    OR NEW.home_location_id IS DISTINCT FROM OLD.home_location_id
    OR NEW.token_digest <> OLD.token_digest
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
    OR NEW.consumed_at IS NULL
    OR NEW.consumed_identity_binding_id IS NULL
    OR NEW.consumed_user_id IS NULL
    OR NEW.consumed_membership_id IS NULL
    OR NEW.redemption_command_id IS NULL
    OR NEW.row_version <> OLD.row_version + 1
  THEN
    RAISE EXCEPTION 'Invalid Membership invitation mutation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$guard$;

CREATE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(
  requested_command_id uuid,
  requested_token_digest bytea,
  verified_issuer text,
  verified_subject text,
  generated_user_id uuid,
  generated_identity_binding_id uuid,
  generated_membership_id uuid
)
RETURNS TABLE (
  result_status text,
  result_organization_name text,
  result_membership_display_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $redeem$
DECLARE
  invitation taptime_server.employee_membership_invitations%ROWTYPE;
  creator taptime_server.memberships%ROWTYPE;
  binding taptime_server.identity_bindings%ROWTYPE;
  receipt taptime_server.employee_enrollment_redemption_receipts%ROWTYPE;
  resolved_user_id uuid;
  resolved_binding_id uuid;
  identity_lock_hash bytea;
  existing_membership taptime_server.memberships%ROWTYPE;
  safe_organization_name text;
  selected_role text := pg_catalog.current_setting('role', true);
BEGIN
  IF selected_role NOT IN (
      'taptime_employee_enrollment_redeemer',
      'taptime_membership_enrollment_redeemer'
    )
    OR requested_command_id IS NULL
    OR requested_token_digest IS NULL
    OR pg_catalog.octet_length(requested_token_digest) <> 32
    OR verified_issuer IS NULL OR verified_subject IS NULL
    OR pg_catalog.length(pg_catalog.btrim(verified_issuer)) = 0
    OR pg_catalog.length(pg_catalog.btrim(verified_subject)) = 0
    OR pg_catalog.octet_length(verified_issuer) > 2048
    OR pg_catalog.octet_length(verified_subject) > 2048
    OR generated_user_id IS NULL OR generated_identity_binding_id IS NULL
    OR generated_membership_id IS NULL
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::text;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:invitation-digest:v1:' || pg_catalog.encode(requested_token_digest, 'hex'), 0
  ));
  SELECT candidate.* INTO invitation
  FROM taptime_server.employee_membership_invitations AS candidate
  WHERE candidate.token_digest = requested_token_digest
  FOR UPDATE;
  IF NOT FOUND
    OR (selected_role = 'taptime_employee_enrollment_redeemer'
      AND invitation.membership_role <> 'employee')
  THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  identity_lock_hash := pg_catalog.sha256(
    pg_catalog.convert_to('taptime:c3:identity:v1', 'UTF8') || pg_catalog.decode('00', 'hex')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_issuer, 'UTF8')))
    || pg_catalog.convert_to(verified_issuer, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_subject, 'UTF8')))
    || pg_catalog.convert_to(verified_subject, 'UTF8')
  );

  IF invitation.consumed_at IS NOT NULL THEN
    IF invitation.redemption_command_id <> requested_command_id THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(pg_catalog.encode(identity_lock_hash, 'hex'), 0)
    );
    SELECT candidate.* INTO binding
    FROM taptime_server.identity_bindings AS candidate
    WHERE candidate.issuer = verified_issuer AND candidate.subject = verified_subject
    FOR SHARE;
    IF NOT FOUND OR binding.revoked_at IS NOT NULL
      OR binding.id <> invitation.consumed_identity_binding_id
      OR binding.user_id <> invitation.consumed_user_id
    THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'taptime:c3:bootstrap:user:' || binding.user_id::text, 0
    ));
    PERFORM 1 FROM taptime_server.users AS app_user WHERE app_user.id = binding.user_id FOR SHARE;
    SELECT stored.* INTO receipt
    FROM taptime_server.employee_enrollment_redemption_receipts AS stored
    WHERE stored.command_id = requested_command_id;
    SELECT membership.* INTO existing_membership
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = invitation.organization_id
      AND membership.id = invitation.consumed_membership_id
      AND membership.user_id = binding.user_id
      AND membership.role = invitation.membership_role
      AND membership.revoked_at IS NULL
      AND (
        invitation.home_location_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM taptime_server.membership_home_location_assignments AS home
          WHERE home.organization_id = invitation.organization_id
            AND home.membership_id = membership.id
            AND home.location_id = invitation.home_location_id
            AND home.revoked_at IS NULL
        )
      )
    FOR SHARE;
    IF receipt.command_id IS NULL
      OR receipt.invitation_id <> invitation.id
      OR receipt.identity_binding_id <> binding.id
      OR receipt.user_id <> binding.user_id
      OR receipt.membership_id <> invitation.consumed_membership_id
      OR existing_membership.id IS NULL
    THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    SELECT organization.name INTO safe_organization_name
    FROM taptime_server.organizations AS organization
    WHERE organization.id = invitation.organization_id;
    RETURN QUERY SELECT 'succeeded', safe_organization_name, existing_membership.display_name;
    RETURN;
  END IF;

  IF invitation.expires_at <= pg_catalog.transaction_timestamp() THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT membership.* INTO creator
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = invitation.organization_id
    AND membership.id = invitation.creator_membership_id
    AND membership.user_id = invitation.creator_user_id
  FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      invitation.organization_id, invitation.creator_user_id,
      invitation.creator_membership_id, 'invite', NULL,
      invitation.membership_role, invitation.home_location_id
    )
  ) THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(identity_lock_hash, 'hex'), 0)
  );
  SELECT candidate.* INTO binding
  FROM taptime_server.identity_bindings AS candidate
  WHERE candidate.issuer = verified_issuer AND candidate.subject = verified_subject
  FOR SHARE;
  IF FOUND THEN
    IF binding.revoked_at IS NOT NULL THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    resolved_user_id := binding.user_id;
    resolved_binding_id := binding.id;
  ELSE
    resolved_user_id := generated_user_id;
    resolved_binding_id := generated_identity_binding_id;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3:bootstrap:user:' || resolved_user_id::text, 0
  ));
  IF binding.id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.users AS app_user
    WHERE app_user.id = resolved_user_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'IdentityBinding references a missing User'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM taptime_server.users AS app_user WHERE app_user.id = resolved_user_id
  ) THEN
    RAISE EXCEPTION 'Generated T-009 User ID collision';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:redemption-command:v1:' || requested_command_id::text, 0
  ));
  SELECT stored.* INTO receipt
  FROM taptime_server.employee_enrollment_redemption_receipts AS stored
  WHERE stored.command_id = requested_command_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  FOR existing_membership IN
    SELECT membership.* FROM taptime_server.memberships AS membership
    WHERE membership.user_id = resolved_user_id
    ORDER BY membership.organization_id, membership.id
    FOR SHARE
  LOOP
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END LOOP;

  IF binding.id IS NULL THEN
    INSERT INTO taptime_server.users (id) VALUES (resolved_user_id);
    INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject)
    VALUES (resolved_binding_id, resolved_user_id, verified_issuer, verified_subject);
  END IF;

  PERFORM pg_catalog.set_config('app.organization_id', invitation.organization_id::text, true);
  PERFORM pg_catalog.set_config('app.user_id', invitation.creator_user_id::text, true);
  PERFORM pg_catalog.set_config('app.membership_id', invitation.creator_membership_id::text, true);
  PERFORM pg_catalog.set_config('app.membership_role', creator.role, true);
  PERFORM pg_catalog.set_config('app.correlation_id', requested_command_id::text, true);

  INSERT INTO taptime_server.memberships (
    id, organization_id, user_id, role, created_by_user_id, display_name
  ) VALUES (
    generated_membership_id, invitation.organization_id, resolved_user_id,
    invitation.membership_role, invitation.creator_user_id, invitation.display_name
  );
  IF invitation.home_location_id IS NOT NULL THEN
    INSERT INTO taptime_server.membership_home_location_assignments (
      id, organization_id, membership_id, location_id
    ) VALUES (
      pg_catalog.gen_random_uuid(), invitation.organization_id,
      generated_membership_id, invitation.home_location_id
    );
  END IF;
  UPDATE taptime_server.employee_membership_invitations
  SET consumed_at = pg_catalog.transaction_timestamp(),
      consumed_identity_binding_id = resolved_binding_id,
      consumed_user_id = resolved_user_id,
      consumed_membership_id = generated_membership_id,
      redemption_command_id = requested_command_id,
      row_version = row_version + 1
  WHERE id = invitation.id;
  INSERT INTO taptime_server.employee_enrollment_redemption_receipts (
    command_id, invitation_id, organization_id, actor_user_id, actor_membership_id,
    identity_binding_id, user_id, membership_id, token_digest
  ) VALUES (
    requested_command_id, invitation.id, invitation.organization_id,
    invitation.creator_user_id, invitation.creator_membership_id,
    resolved_binding_id, resolved_user_id, generated_membership_id,
    requested_token_digest
  );
  SELECT organization.name INTO safe_organization_name
  FROM taptime_server.organizations AS organization
  WHERE organization.id = invitation.organization_id;
  RETURN QUERY SELECT 'succeeded', safe_organization_name, invitation.display_name;
END
$redeem$;

CREATE OR REPLACE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  requested_command_id uuid,
  requested_token_digest bytea,
  verified_issuer text,
  verified_subject text,
  generated_user_id uuid,
  generated_identity_binding_id uuid,
  generated_membership_id uuid
)
RETURNS TABLE (
  result_status text,
  result_organization_name text,
  result_membership_display_name text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $compatibility$
  SELECT result.result_status, result.result_organization_name,
         result.result_membership_display_name
  FROM taptime_server.redeem_employee_membership_invitation_data_v2(
    requested_command_id, requested_token_digest, verified_issuer, verified_subject,
    generated_user_id, generated_identity_binding_id, generated_membership_id
  ) AS result
$compatibility$;

ALTER FUNCTION taptime_server.membership_invitation_request_digest_v3(
  uuid, uuid, uuid, text, text, uuid
) OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.create_membership_invitation_v3(
  uuid, uuid, text, text, uuid, bytea
) OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.create_membership_invitation_v2(
  uuid, uuid, text, text, bytea
) OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_managed_memberships_v1(uuid, integer)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.manage_membership_v1(uuid, uuid, bigint, text, text)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) OWNER TO taptime_employee_redemption_data_function_owner;
ALTER FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) OWNER TO taptime_employee_redemption_data_function_owner;

GRANT SELECT ON taptime_server.locations,
  taptime_server.membership_home_location_assignments,
  taptime_server.membership_management_location_grants
  TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text, uuid
) TO taptime_membership_management_function_owner,
     taptime_employee_redemption_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.membership_invitation_request_digest_v3(
  uuid, uuid, uuid, text, text, uuid
) TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.create_membership_invitation_v3(
  uuid, uuid, text, text, uuid, bytea
) TO taptime_membership_manager;
GRANT EXECUTE ON FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) TO taptime_employee_redemption_data_function_owner;
GRANT INSERT (id, organization_id, membership_id, location_id)
  ON taptime_server.membership_home_location_assignments
  TO taptime_employee_redemption_data_function_owner;
GRANT SELECT ON taptime_server.membership_home_location_assignments
  TO taptime_employee_redemption_data_function_owner;

REVOKE ALL ON FUNCTION taptime_server.membership_invitation_request_digest_v3(
  uuid, uuid, uuid, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.create_membership_invitation_v3(
  uuid, uuid, text, text, uuid, bytea
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) FROM PUBLIC;

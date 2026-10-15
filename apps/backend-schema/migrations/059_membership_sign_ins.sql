-- T-105: session sign-ins are display data only, never work events or audit payloads.
-- Migration creates the storage/NOLOGIN owner; session endpoints create and update rows.
-- Organization removal cascades to these rows. Future migrations maintain the owner;
-- retirement drops the table/functions, revokes its remaining grants, then drops the role.
DO $owner$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='taptime_membership_sign_in_owner') THEN
    CREATE ROLE taptime_membership_sign_in_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END $owner$;
ALTER ROLE taptime_membership_sign_in_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_membership_sign_in_owner;
-- BYPASSRLS is limited to the columns needed to validate and lock the resolved actor,
-- following 058. No runtime login is a member of this owner.
GRANT SELECT (id,user_id,organization_id,revoked_at), UPDATE (id)
  ON taptime_server.memberships TO taptime_membership_sign_in_owner;
GRANT SELECT (id,status), UPDATE (id)
  ON taptime_server.organizations TO taptime_membership_sign_in_owner;

CREATE TABLE taptime_server.membership_sign_ins (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  first_signed_in_at timestamptz NOT NULL,
  last_signed_in_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id,membership_id),
  FOREIGN KEY (organization_id,membership_id) REFERENCES taptime_server.memberships(organization_id,id) ON DELETE CASCADE,
  CHECK (pg_catalog.isfinite(first_signed_in_at) AND pg_catalog.isfinite(last_signed_in_at)
    AND last_signed_in_at >= first_signed_in_at)
);
ALTER TABLE taptime_server.membership_sign_ins OWNER TO taptime_membership_sign_in_owner;
ALTER TABLE taptime_server.membership_sign_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_sign_ins FORCE ROW LEVEL SECURITY;
-- No direct runtime SELECT or DML grant. The policy also protects a future tenant reader.
CREATE POLICY membership_sign_ins_tenant_read ON taptime_server.membership_sign_ins FOR SELECT
  USING (organization_id = NULLIF(pg_catalog.current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT ON taptime_server.membership_sign_ins TO taptime_membership_management_function_owner;

CREATE FUNCTION taptime_server.record_membership_sign_in_v1(
  requested_organization_id uuid, requested_user_id uuid, requested_membership_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $sign_in$
DECLARE signed_in_at timestamptz;
BEGIN
  IF pg_catalog.current_setting('role',true) IS DISTINCT FROM 'taptime_identity_resolver' THEN
    RAISE EXCEPTION 'Sign-in authority rejected' USING ERRCODE='42501';
  END IF;
  -- Session authority comes from the verified identity, never an HTTP body. Recheck
  -- active membership and organization here, locking against a concurrent revocation.
  PERFORM 1 FROM taptime_server.memberships AS membership
    JOIN taptime_server.organizations AS organization ON organization.id=membership.organization_id
    WHERE membership.organization_id=requested_organization_id AND membership.id=requested_membership_id
      AND membership.user_id=requested_user_id AND membership.revoked_at IS NULL AND organization.status='active'
    FOR SHARE OF membership,organization;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sign-in authority rejected' USING ERRCODE='42501'; END IF;
  signed_in_at := pg_catalog.clock_timestamp();
  INSERT INTO taptime_server.membership_sign_ins AS current_sign_in
    (organization_id,membership_id,first_signed_in_at,last_signed_in_at)
    VALUES(requested_organization_id,requested_membership_id,signed_in_at,signed_in_at)
    ON CONFLICT (organization_id,membership_id) DO UPDATE
      SET last_signed_in_at=GREATEST(current_sign_in.last_signed_in_at,EXCLUDED.last_signed_in_at);
END $sign_in$;
ALTER FUNCTION taptime_server.record_membership_sign_in_v1(uuid,uuid,uuid) OWNER TO taptime_membership_sign_in_owner;
REVOKE ALL ON FUNCTION taptime_server.record_membership_sign_in_v1(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.record_membership_sign_in_v1(uuid,uuid,uuid) TO taptime_identity_resolver;

CREATE FUNCTION taptime_server.read_managed_memberships_v4(
  requested_location_id uuid,
  requested_search text,
  requested_active boolean,
  after_display_name text,
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  result_status text,
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text,
  membership_role text,
  membership_active boolean,
  membership_row_version bigint,
  location_id uuid,
  location_name text,
  first_signed_in_at timestamptz,
  last_signed_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $projection$
DECLARE
  context_organization_id uuid := NULLIF(
    pg_catalog.current_setting('app.organization_id', true), ''
  )::uuid;
  context_user_id uuid := NULLIF(
    pg_catalog.current_setting('app.user_id', true), ''
  )::uuid;
  context_membership_id uuid := NULLIF(
    pg_catalog.current_setting('app.membership_id', true), ''
  )::uuid;
  organization_locations_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_limit NOT BETWEEN 1 AND 51
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid,
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT organization.locations_enabled
  INTO organization_locations_enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = context_organization_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid,
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF requested_location_id IS NOT NULL
    AND (
      NOT organization_locations_enabled
      OR NOT (
        EXISTS (
          SELECT 1
          FROM taptime_server.has_membership_management_authority_v1(
            context_organization_id, context_user_id, context_membership_id,
            'read', NULL, NULL, NULL
          ) AS authority
          WHERE authority.scope_kind = 'location'
            AND authority.location_id = requested_location_id
        )
        OR (
          EXISTS (
            SELECT 1
            FROM taptime_server.has_membership_management_authority_v1(
              context_organization_id, context_user_id, context_membership_id,
              'read', NULL, NULL, NULL
            ) AS authority
            WHERE authority.scope_kind = 'organization'
              AND authority.location_id IS NULL
          )
          AND EXISTS (
            SELECT 1 FROM taptime_server.locations AS location
            WHERE location.organization_id = context_organization_id
              AND location.id = requested_location_id
              AND location.active
          )
        )
      )
    )
  THEN
    RETURN QUERY SELECT 'location_scope_forbidden'::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::bigint,
      NULL::uuid, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (requested_cursor IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;

  RETURN QUERY
  WITH management_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    ) AS authority
  )
  SELECT 'succeeded'::text, organization.id, organization.name, page.id,
         COALESCE(
           page.display_name,
           CASE page.role
             WHEN 'administrator' THEN 'Administrator'
             WHEN 'standortleitung' THEN 'Standortleitung'
             ELSE 'Beschäftigter'
           END
         ),
         page.role, page.revoked_at IS NULL, page.row_version,
         page.location_id, page.location_name,
         page.first_signed_in_at, page.last_signed_in_at
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version,
           home.location_id, location.display_name AS location_name,
           sign_in.first_signed_in_at, sign_in.last_signed_in_at
    FROM taptime_server.memberships AS membership
    LEFT JOIN taptime_server.membership_sign_ins AS sign_in
      ON sign_in.organization_id = membership.organization_id
     AND sign_in.membership_id = membership.id
    LEFT JOIN taptime_server.membership_home_location_assignments AS home
      ON organization_locations_enabled
     AND home.organization_id = membership.organization_id
     AND home.membership_id = membership.id
     AND home.revoked_at IS NULL
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id
     AND location.id = home.location_id
    WHERE membership.organization_id = organization.id
      AND (requested_active IS NULL OR (membership.revoked_at IS NULL) = requested_active)
      AND (requested_cursor IS NULL OR (COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",membership.id)>(after_display_name COLLATE "und-x-icu",requested_cursor))
      AND (requested_search IS NULL OR strpos(lower(COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (
        EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'organization' AND scope.location_id IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'location'
            AND scope.location_id = home.location_id
        )
      )
      AND (
        requested_location_id IS NULL
        OR home.location_id = requested_location_id
      )
    ORDER BY COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",membership.id
    LIMIT requested_limit
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope)
  ORDER BY COALESCE(page.display_name,CASE page.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",page.id;
END
$projection$;
ALTER FUNCTION taptime_server.read_managed_memberships_v4(uuid,text,boolean,text,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_memberships_v4(uuid,text,boolean,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_memberships_v4(uuid,text,boolean,text,uuid,integer) TO taptime_membership_manager;

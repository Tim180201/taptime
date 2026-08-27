-- T-015c: versioned server-derived administration drawing contract.

CREATE FUNCTION taptime_server.read_administration_session_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_actor_membership_id uuid
)
RETURNS TABLE (
  locations_enabled boolean,
  setup_available boolean,
  employees_available boolean,
  time_records_available boolean,
  time_export_available boolean,
  review_items_available boolean,
  management_scope_kind text,
  management_location_id uuid,
  management_location_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $session$
DECLARE
  actor_role text;
  feature_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_identity_resolver'
    OR requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_actor_membership_id IS NULL
  THEN
    RETURN;
  END IF;

  SELECT membership.role, organization.locations_enabled
  INTO actor_role, feature_enabled
  FROM taptime_server.organizations AS organization
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = organization.id
   AND membership.user_id = requested_actor_user_id
   AND membership.id = requested_actor_membership_id
   AND membership.revoked_at IS NULL
  WHERE organization.id = requested_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.set_config(
    'app.organization_id', requested_organization_id::text, true
  );
  PERFORM pg_catalog.set_config('app.user_id', requested_actor_user_id::text, true);
  PERFORM pg_catalog.set_config(
    'app.membership_id', requested_actor_membership_id::text, true
  );
  PERFORM pg_catalog.set_config('app.membership_role', actor_role, true);

  RETURN QUERY
  WITH membership_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      requested_organization_id, requested_actor_user_id,
      requested_actor_membership_id, 'read', NULL, NULL, NULL
    ) AS authority
  ),
  section_authority AS MATERIALIZED (
    SELECT
      taptime_server.has_current_admin_setup_authority(
        requested_organization_id
      ) AS setup_available,
      EXISTS (SELECT 1 FROM membership_scope) AS employees_available,
      taptime_server.has_current_time_review_administrator_v1(
        requested_organization_id, requested_actor_user_id,
        requested_actor_membership_id
      ) AS time_review_available,
      taptime_server.has_current_time_export_authority(
        requested_organization_id
      ) AS time_export_available
  ),
  scope_shape AS MATERIALIZED (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM membership_scope
        WHERE scope_kind = 'organization' AND location_id IS NULL
      ) THEN 'organization'::text
      ELSE 'locations'::text
    END AS scope_kind
  ),
  location_scope AS (
    SELECT scope.location_id, location.display_name
    FROM membership_scope AS scope
    JOIN taptime_server.locations AS location
      ON scope.scope_kind = 'location'
     AND scope.location_id = location.id
     AND location.organization_id = requested_organization_id
     AND location.active
  )
  SELECT feature_enabled,
         section_authority.setup_available,
         section_authority.employees_available,
         section_authority.time_review_available,
         section_authority.time_export_available,
         section_authority.time_review_available,
         scope_shape.scope_kind,
         location_scope.location_id,
         location_scope.display_name
  FROM section_authority
  CROSS JOIN scope_shape
  LEFT JOIN location_scope ON scope_shape.scope_kind = 'locations'
  ORDER BY location_scope.display_name, location_scope.location_id;
END
$session$;

CREATE FUNCTION taptime_server.read_managed_memberships_v2(
  requested_location_id uuid,
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
  location_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
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
    OR requested_limit NOT BETWEEN 1 AND 20
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
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT organization.locations_enabled
  INTO organization_locations_enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = context_organization_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid,
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text;
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
      NULL::uuid, NULL::text;
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
         page.location_id, page.location_name
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version,
           home.location_id, location.display_name AS location_name
    FROM taptime_server.memberships AS membership
    LEFT JOIN taptime_server.membership_home_location_assignments AS home
      ON organization_locations_enabled
     AND home.organization_id = membership.organization_id
     AND home.membership_id = membership.id
     AND home.revoked_at IS NULL
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id
     AND location.id = home.location_id
    WHERE membership.organization_id = organization.id
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
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
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope);
END
$projection$;

ALTER FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_managed_memberships_v2(uuid, uuid, integer)
  OWNER TO taptime_membership_management_function_owner;

GRANT EXECUTE ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid),
  taptime_server.has_current_time_export_authority(uuid),
  taptime_server.has_current_time_review_administrator_v1(uuid, uuid, uuid)
  TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid)
  TO taptime_identity_resolver;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_memberships_v2(uuid, uuid, integer)
  TO taptime_membership_manager;

REVOKE ALL ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_managed_memberships_v2(uuid, uuid, integer)
  FROM PUBLIC;

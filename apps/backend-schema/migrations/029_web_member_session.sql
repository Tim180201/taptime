-- T-049: Web access follows every live membership. No new persisted entity.
-- Existing return columns and their authority stay unchanged (including 027).
-- Explicit SELECT lists of installed servers remain compatible.
DROP FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid);
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
  management_location_name text,
  nfc_setup_available boolean,
  role text,
  own_time_available boolean,
  manual_capture_available boolean
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
         location_scope.display_name,
         taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, NULL),
         actor_role, true, true
  FROM section_authority
  CROSS JOIN scope_shape
  LEFT JOIN location_scope ON scope_shape.scope_kind = 'locations'
  ORDER BY location_scope.display_name, location_scope.location_id;
END
$session$;

ALTER FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid)
  OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid) TO taptime_identity_resolver;

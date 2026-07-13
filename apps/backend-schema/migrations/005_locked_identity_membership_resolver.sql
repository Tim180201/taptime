CREATE FUNCTION taptime_server.lock_request_actor(
  verified_issuer text,
  verified_subject text
)
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  membership_id uuid,
  membership_role text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server, pg_temp
ROWS 1
AS $$
BEGIN
  RETURN QUERY
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
  FOR SHARE OF binding, membership;
END
$$;

REVOKE ALL ON FUNCTION taptime_server.lock_request_actor(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_request_actor(text, text)
  TO taptime_identity_resolver;

CREATE FUNCTION taptime_server.lock_lifecycle_configuration(
  requested_organization_id uuid,
  requested_assignment_id uuid
)
RETURNS TABLE (
  assignment_id uuid,
  nfc_tag_id uuid,
  target_type text,
  target_customer_id uuid,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  tag_created_at timestamptz,
  customer_active boolean,
  customer_activated_at timestamptz,
  customer_deactivated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server, pg_temp
ROWS 1
AS $$
BEGIN
  RETURN QUERY
  SELECT
    assignment.id,
    tag.id,
    assignment.target_type,
    assignment.target_customer_id,
    assignment.active,
    assignment.valid_from,
    assignment.valid_to,
    tag.created_at,
    customer.active,
    customer.activated_at,
    customer.deactivated_at
  FROM taptime_server.nfc_assignments AS assignment
  INNER JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  INNER JOIN taptime_server.customers AS customer
    ON customer.organization_id = assignment.organization_id
   AND customer.id = assignment.target_customer_id
  WHERE requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
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
        AND membership.revoked_at IS NULL
    )
  FOR SHARE OF assignment, tag, customer;
END
$$;

REVOKE ALL ON FUNCTION taptime_server.lock_lifecycle_configuration(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_lifecycle_configuration(uuid, uuid)
  TO taptime_server_lifecycle;

-- The taptime_administrator application role is selected only by the read model.
-- Product write paths use narrower dedicated capability roles.
REVOKE UPDATE (name, row_version)
  ON taptime_server.organizations FROM taptime_administrator;
REVOKE INSERT (id, organization_id, user_id, role, created_by_user_id),
  UPDATE (role, revoked_at, row_version)
  ON taptime_server.memberships FROM taptime_administrator;
REVOKE INSERT (id, organization_id, active, display_name),
  UPDATE (active, deactivated_at, row_version)
  ON taptime_server.customers FROM taptime_administrator;
REVOKE DELETE ON taptime_server.customers FROM taptime_administrator;
REVOKE INSERT (id, organization_id, payload_value, display_name)
  ON taptime_server.nfc_tags FROM taptime_administrator;
REVOKE DELETE ON taptime_server.nfc_tags FROM taptime_administrator;
REVOKE INSERT (id, organization_id, nfc_tag_id, target_type, target_customer_id, active),
  UPDATE (active, valid_to, row_version)
  ON taptime_server.nfc_assignments FROM taptime_administrator;

DO $verify_administrator_read_only$
DECLARE
  offending text;
BEGIN
  SELECT pg_catalog.string_agg(
    pg_catalog.format('%s:%s', target.table_name, privilege.privilege_name),
    ', ' ORDER BY target.table_name, privilege.privilege_name
  )
  INTO offending
  FROM (
    VALUES
      ('organizations', 'taptime_server.organizations'::pg_catalog.regclass),
      ('memberships', 'taptime_server.memberships'::pg_catalog.regclass),
      ('customers', 'taptime_server.customers'::pg_catalog.regclass),
      ('nfc_tags', 'taptime_server.nfc_tags'::pg_catalog.regclass),
      ('nfc_assignments', 'taptime_server.nfc_assignments'::pg_catalog.regclass)
  ) AS target(table_name, relation_oid)
  CROSS JOIN (
    VALUES ('INSERT'), ('UPDATE'), ('DELETE')
  ) AS privilege(privilege_name)
  WHERE CASE privilege.privilege_name
    WHEN 'INSERT' THEN
      pg_catalog.has_table_privilege(
        'taptime_administrator', target.relation_oid, 'INSERT'
      )
      OR pg_catalog.has_any_column_privilege(
        'taptime_administrator', target.relation_oid, 'INSERT'
      )
    WHEN 'UPDATE' THEN
      pg_catalog.has_table_privilege(
        'taptime_administrator', target.relation_oid, 'UPDATE'
      )
      OR pg_catalog.has_any_column_privilege(
        'taptime_administrator', target.relation_oid, 'UPDATE'
      )
    WHEN 'DELETE' THEN
      pg_catalog.has_table_privilege(
        'taptime_administrator', target.relation_oid, 'DELETE'
      )
    ELSE true
  END;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'taptime_administrator retains unused write privileges: %', offending
      USING ERRCODE = '42501';
  END IF;
END
$verify_administrator_read_only$;

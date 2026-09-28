-- T-085. Administrators / current Location managers append settings; NULL removes
-- the quota. Previous settings are never edited or deleted. No employee capability.
CREATE TABLE taptime_server.customer_quota_settings (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations(id),
  customer_id uuid NOT NULL,
  minutes integer CHECK (minutes BETWEEN 30 AND 44640 AND minutes % 30 = 0),
  set_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_membership_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('administrator','standortleitung','employee')),
  command_id uuid NOT NULL,
  FOREIGN KEY (organization_id,customer_id) REFERENCES taptime_server.customers(organization_id,id),
  FOREIGN KEY (organization_id,actor_membership_id) REFERENCES taptime_server.memberships(organization_id,id),
  UNIQUE (organization_id,command_id)
);
CREATE INDEX customer_quota_month_lookup ON taptime_server.customer_quota_settings
  (organization_id,customer_id,set_at DESC,sequence DESC);
ALTER TABLE taptime_server.customer_quota_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.customer_quota_settings FORCE ROW LEVEL SECURITY;
CREATE TRIGGER customer_quota_append_only BEFORE UPDATE OR DELETE ON taptime_server.customer_quota_settings
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();

GRANT SELECT ON taptime_server.customer_quota_settings TO taptime_admin_setup,
  taptime_admin_setup_data_function_owner,taptime_time_review_read_function_owner;
GRANT INSERT (organization_id,customer_id,minutes,actor_membership_id,actor_role,command_id)
  ON taptime_server.customer_quota_settings TO taptime_admin_setup,taptime_admin_setup_data_function_owner;
GRANT USAGE ON SEQUENCE taptime_server.customer_quota_settings_sequence_seq
  TO taptime_admin_setup,taptime_admin_setup_data_function_owner;
CREATE POLICY quota_setup_read ON taptime_server.customer_quota_settings FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id,customer_id));
CREATE POLICY quota_setup_write ON taptime_server.customer_quota_settings FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id,customer_id)
    AND actor_membership_id=NULLIF(current_setting('app.membership_id',true),'')::uuid
    AND actor_role=current_setting('app.membership_role',true)
    AND actor_role IN ('administrator','standortleitung')
    AND command_id=NULLIF(current_setting('app.correlation_id',true),'')::uuid);

GRANT SELECT (id,status) ON taptime_server.organizations TO taptime_admin_setup_data_function_owner;

CREATE FUNCTION taptime_server.set_customer_quota_v1(requested_customer uuid,requested_minutes integer,requested_command uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $quota$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id',true),'')::uuid;
  live_role text;
  prior taptime_server.customer_quota_settings%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
    OR NOT taptime_server.has_current_nfc_setup_authority_v1(org,requested_customer)
    OR requested_customer IS NULL
    OR NOT EXISTS(SELECT 1 FROM taptime_server.customers WHERE organization_id=org AND id=requested_customer)
    OR NOT EXISTS(SELECT 1 FROM taptime_server.organizations WHERE id=org AND status='active')
  THEN RAISE EXCEPTION 'Quota authority rejected' USING ERRCODE='42501'; END IF;
  IF requested_command IS NULL OR (requested_minutes IS NOT NULL AND
    (requested_minutes<30 OR requested_minutes>44640 OR requested_minutes%30<>0))
  THEN RAISE EXCEPTION 'Invalid quota' USING ERRCODE='22023'; END IF;
  SELECT role INTO live_role FROM taptime_server.memberships WHERE organization_id=org AND id=actor AND revoked_at IS NULL;
  -- One order for concurrent commands for the same customer, including equal timestamps.
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-quota:'||org::text||':'||requested_command::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-quota:'||org::text||':'||requested_customer::text,0));
  SELECT * INTO prior FROM taptime_server.customer_quota_settings WHERE organization_id=org AND command_id=requested_command;
  IF FOUND THEN
    IF prior.customer_id=requested_customer AND prior.minutes IS NOT DISTINCT FROM requested_minutes
      AND prior.actor_membership_id=actor AND prior.actor_role=live_role THEN RETURN 'succeeded'; END IF;
    RETURN 'command_id_conflict';
  END IF;
  INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,actor_membership_id,actor_role,command_id)
    VALUES(org,requested_customer,requested_minutes,actor,live_role,requested_command);
  RETURN 'succeeded';
END $quota$;
ALTER FUNCTION taptime_server.set_customer_quota_v1(uuid,integer,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.set_customer_quota_v1(uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.set_customer_quota_v1(uuid,integer,uuid) TO taptime_admin_setup;

-- V1 and migration 036 stay intact for clients with exact-field parsers. The new
-- reader consumes V1's authorized rows and seconds, never a second hours formula.
CREATE FUNCTION taptime_server.read_customer_hours_v2(from_inclusive timestamptz,to_exclusive timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $read$
DECLARE result jsonb;
BEGIN
  result := taptime_server.read_customer_hours_v1(from_inclusive,to_exclusive);
  result := jsonb_set(result,'{version}','"customer-hours.v2"'::jsonb);
  IF result->>'scope'='self' THEN RETURN result; END IF;
  RETURN jsonb_set(result,'{customers}',(
    SELECT COALESCE(jsonb_agg(customer.value || jsonb_build_object(
      'quotaSeconds',quota.minutes*60,
      'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
        WHEN (customer.value->>'workDurationSeconds')::bigint>=quota.minutes*60 THEN 'exceeded'
        WHEN (customer.value->>'workDurationSeconds')::bigint*10>=quota.minutes::bigint*60*9 THEN 'warning'
        ELSE 'ok' END) ORDER BY customer.ordinality),'[]'::jsonb)
    FROM jsonb_array_elements(result->'customers') WITH ORDINALITY customer
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE setting.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
        AND setting.customer_id=(customer.value->>'customerId')::uuid AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
  ));
END $read$;
ALTER FUNCTION taptime_server.read_customer_hours_v2(timestamptz,timestamptz) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_hours_v2(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_hours_v2(timestamptz,timestamptz) TO taptime_mobile_own_time_reader;

-- T-086 P3: xid conversion remains valid beyond the first transaction epoch.
CREATE OR REPLACE FUNCTION taptime_server.is_current_customer_creation_v1(
  requested_organization_id uuid, requested_customer_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $creation$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.customers AS customer
    JOIN taptime_server.audit_events AS audit
      ON audit.organization_id = customer.organization_id AND audit.entity_id = customer.id
    WHERE customer.organization_id = requested_organization_id AND customer.id = requested_customer_id
      AND customer.active AND customer.xmin = pg_catalog.xid(pg_current_xact_id())
      AND audit.event_type = 'CustomerCreated' AND audit.entity_type = 'Customer'
      AND audit.actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      AND audit.correlation_id = NULLIF(current_setting('app.correlation_id', true), '')
  )
$creation$;

-- T-116a B: close one assignment without deleting the tag, original events or times.
-- The existing reuse capability creates later assignments; audit retention is unchanged.
CREATE FUNCTION taptime_server.remove_nfc_tag_v1(requested_tag uuid, requested_assignment uuid, requested_command uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $remove$
DECLARE
 org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 request jsonb;
 prior record;
 assignment taptime_server.nfc_assignments%ROWTYPE;
 target_customer uuid;
 result jsonb;
 removed_at timestamptz;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
   OR NOT taptime_server.has_current_nfc_setup_authority_v1(org,NULL)
   OR NOT taptime_server.has_current_nfc_tag_setup_authority_v1(org,requested_tag)
   OR NOT EXISTS(SELECT 1 FROM taptime_server.nfc_tags WHERE organization_id=org AND id=requested_tag)
 THEN RAISE EXCEPTION 'Tag removal authority rejected' USING ERRCODE='42501'; END IF;
 IF requested_tag IS NULL OR requested_assignment IS NULL OR requested_command IS NULL
   OR requested_command::text IS DISTINCT FROM current_setting('app.correlation_id',true)
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 request:=jsonb_build_object('nfcTagId',requested_tag,'expectedAssignmentId',requested_assignment,
   'membershipId',current_setting('app.membership_id',true));
 PERFORM pg_advisory_xact_lock(hashtextextended('taptime:t015e:location-setup:v1:'||org::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('tag-removal:'||org::text||':'||requested_command::text,0));
 IF NOT taptime_server.has_current_nfc_setup_authority_v1(org,NULL)
   OR NOT taptime_server.has_current_nfc_tag_setup_authority_v1(org,requested_tag)
 THEN RAISE EXCEPTION 'Tag removal scope changed' USING ERRCODE='42501'; END IF;
 SELECT payload INTO prior FROM taptime_server.audit_events
   WHERE organization_id=org AND correlation_id=requested_command::text AND event_type='NfcTagRemoved';
 IF FOUND THEN
   IF prior.payload->'request'=request THEN RETURN prior.payload->'result'; END IF;
   RETURN jsonb_build_object('status','command_id_conflict');
 END IF;
 -- Target identity never changes. Lock it before the assignment, as capture/deletion do.
 SELECT target_customer_id INTO target_customer FROM taptime_server.nfc_assignments
   WHERE organization_id=org AND nfc_tag_id=requested_tag AND id=requested_assignment;
 IF target_customer IS NOT NULL THEN
   PERFORM 1 FROM taptime_server.work_targets
     WHERE organization_id=org AND target_type='customer' AND target_id=target_customer FOR UPDATE;
 END IF;
 SELECT a.* INTO assignment FROM taptime_server.nfc_assignments a
   JOIN taptime_server.nfc_tags tag ON tag.organization_id=a.organization_id AND tag.id=a.nfc_tag_id
   WHERE a.organization_id=org AND a.nfc_tag_id=requested_tag AND a.id=requested_assignment AND a.active
   FOR UPDATE OF a,tag;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','assignment_changed'); END IF;
 IF NOT taptime_server.has_current_nfc_setup_authority_v1(org,assignment.target_customer_id)
   OR NOT taptime_server.has_current_nfc_tag_setup_authority_v1(org,requested_tag)
 THEN RAISE EXCEPTION 'Tag removal scope changed' USING ERRCODE='42501'; END IF;
 removed_at:=transaction_timestamp();
 UPDATE taptime_server.nfc_assignments SET active=false,valid_to=removed_at,row_version=row_version+1
   WHERE organization_id=org AND id=assignment.id;
 result:=jsonb_build_object('status','succeeded','removedAt',to_char(removed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
 INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,operator_principal,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
 VALUES(gen_random_uuid(),org,NULLIF(current_setting('app.user_id',true),'')::uuid,NULL,'NfcTagRemoved','NfcTag',requested_tag,
   removed_at,requested_command::text,jsonb_build_object('request',request,'result',result));
 RETURN result;
END $remove$;
ALTER FUNCTION taptime_server.remove_nfc_tag_v1(uuid,uuid,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.remove_nfc_tag_v1(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.remove_nfc_tag_v1(uuid,uuid,uuid) TO taptime_admin_setup;

-- Version 1 retains its exact four-field contract for installed clients.
CREATE FUNCTION taptime_server.inspect_nfc_tag_v2(requested_payload text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $inspect$
DECLARE org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid; result jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
   OR NOT taptime_server.has_current_customer_management_authority_v1(org,NULL)
 THEN RAISE EXCEPTION 'Tag inspection rejected' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status','succeeded','assignment',CASE WHEN assignment.assignment_type='break' THEN 'break' ELSE 'customer' END,
   'customerName',customer.display_name,'locationName',location.display_name,
   'nfcTagId',tag.id,'activeAssignmentId',assignment.id) INTO result
 FROM taptime_server.nfc_tags tag
 JOIN taptime_server.nfc_assignments assignment ON assignment.organization_id=tag.organization_id AND assignment.nfc_tag_id=tag.id AND assignment.active
 LEFT JOIN taptime_server.customers customer ON customer.organization_id=assignment.organization_id AND customer.id=assignment.target_customer_id
 LEFT JOIN taptime_server.work_target_location_assignments binding ON binding.organization_id=customer.organization_id AND binding.target_type='customer' AND binding.target_id=customer.id AND binding.revoked_at IS NULL
 LEFT JOIN taptime_server.locations location ON location.organization_id=binding.organization_id AND location.id=binding.location_id
 WHERE tag.organization_id=org AND tag.payload_value=requested_payload AND taptime_server.has_current_nfc_tag_setup_authority_v1(org,tag.id);
 RETURN COALESCE(result,jsonb_build_object('status','succeeded','assignment','unassigned','customerName',NULL,'locationName',NULL,'nfcTagId',NULL,'activeAssignmentId',NULL));
END $inspect$;
ALTER FUNCTION taptime_server.inspect_nfc_tag_v2(text) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.inspect_nfc_tag_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.inspect_nfc_tag_v2(text) TO taptime_admin_setup;

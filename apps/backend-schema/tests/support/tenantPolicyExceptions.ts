// T-119: reviewed indirect tenant bindings, not blanket exclusions. Every entry pins
// the policy's operation, roles and both expressions; widening it requires a new review.
export const tenantPolicyExceptions = [
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "admin_setup_receipts_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "((taptime_server.has_current_admin_setup_authority(organization_id) OR ((command_type = ANY (ARRAY['provisionNfcTag'::text, 'reassignNfcTag'::text])) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id) AND (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments assignment\n  WHERE ((assignment.organization_id = admin_setup_command_receipts.organization_id) AND (assignment.id = admin_setup_command_receipts.result_nfc_assignment_id) AND (assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)))) AND ((result_replaced_assignment_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments replaced\n  WHERE ((replaced.organization_id = admin_setup_command_receipts.organization_id) AND (replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))))))) AND (actor_user_id = taptime_server.current_user_id()) AND (membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_membership_role = current_setting('app.membership_role'::text, true)) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.customers",
    "policy": "customers_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_admin_setup_authority(organization_id) OR (active AND taptime_server.has_current_customer_creation_authority_v1(organization_id, (NULLIF(current_setting('app.customer_creation_location_id'::text, true), ''::text))::uuid)))",
    "reason": "Jeder freigebende Zweig verlangt Verwaltungs- oder Kundenerstellungsautorität; beide vergleichen die Zielorganisation mit app.organization_id und der aktiven Mitgliedschaft."
  },
  {
    "table": "taptime_server.offline_installations",
    "policy": "offline_installations_lease_policy",
    "command": "*",
    "roles": [
      "taptime_offline_lease_issuer"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "check": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_installations",
    "policy": "offline_installations_event_policy",
    "command": "r",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "check": null,
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_capture_leases",
    "policy": "offline_capture_leases_lease_policy",
    "command": "*",
    "roles": [
      "taptime_offline_lease_issuer"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "check": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_capture_leases",
    "policy": "offline_capture_leases_event_policy",
    "command": "r",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "check": null,
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "admin_setup_receipts_assignment_reassigner_insert",
    "command": "a",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": null,
    "check": "((taptime_server.has_current_admin_setup_authority(organization_id) OR ((command_type = ANY (ARRAY['provisionNfcTag'::text, 'reassignNfcTag'::text])) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id) AND (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments assignment\n  WHERE ((assignment.organization_id = admin_setup_command_receipts.organization_id) AND (assignment.id = admin_setup_command_receipts.result_nfc_assignment_id) AND (assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)))) AND ((result_replaced_assignment_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments replaced\n  WHERE ((replaced.organization_id = admin_setup_command_receipts.organization_id) AND (replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))))))) AND (actor_user_id = taptime_server.current_user_id()) AND (membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_membership_role = current_setting('app.membership_role'::text, true)) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid) AND (command_type = 'reassignNfcTag'::text))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.offline_capture_lease_receipts",
    "policy": "offline_lease_receipts_lease_policy",
    "command": "*",
    "roles": [
      "taptime_offline_lease_issuer"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "check": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, identity_binding_id)",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_sync_cursors",
    "policy": "offline_sync_cursors_event_policy",
    "command": "*",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "check": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_event_reconciliations",
    "policy": "offline_reconciliations_reader_policy",
    "command": "r",
    "roles": [
      "taptime_offline_reconciliation_reader"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "check": null,
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.membership_home_location_assignments",
    "policy": "membership_home_locations_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_work_location_grants",
    "policy": "membership_work_locations_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.projects",
    "policy": "projects_project_admin_insert",
    "command": "a",
    "roles": [
      "taptime_project_administrator"
    ],
    "using": null,
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.locations",
    "policy": "locations_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "(taptime_server.has_current_admin_setup_authority(organization_id) OR taptime_server.has_current_customer_creation_authority_v1(organization_id, id))",
    "check": null,
    "reason": "Jeder freigebende Zweig verlangt Verwaltungs- oder Kundenerstellungsautorität; beide vergleichen die Zielorganisation mit app.organization_id und der aktiven Mitgliedschaft."
  },
  {
    "table": "taptime_server.membership_management_location_grants",
    "policy": "membership_management_locations_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.work_target_location_assignments",
    "policy": "work_target_locations_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.locations",
    "policy": "locations_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.locations",
    "policy": "locations_admin_setup_update",
    "command": "w",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_home_location_assignments",
    "policy": "membership_home_locations_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_home_location_assignments",
    "policy": "membership_home_locations_admin_setup_update",
    "command": "w",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_work_location_grants",
    "policy": "membership_work_locations_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_work_location_grants",
    "policy": "membership_work_locations_admin_setup_update",
    "command": "w",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_management_location_grants",
    "policy": "membership_management_locations_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.membership_management_location_grants",
    "policy": "membership_management_locations_admin_setup_update",
    "command": "w",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.work_target_location_assignments",
    "policy": "work_target_locations_admin_setup_update",
    "command": "w",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.location_setup_command_receipts",
    "policy": "location_setup_receipts_admin_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.location_setup_command_receipts",
    "policy": "location_setup_receipts_admin_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_admin_setup_authority(organization_id) AND (actor_user_id = taptime_server.current_user_id()) AND (actor_membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid))",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.memberships",
    "policy": "memberships_admin_location_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.work_targets",
    "policy": "work_targets_admin_location_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.projects",
    "policy": "projects_admin_location_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.offline_event_reconciliations",
    "policy": "offline_reconciliations_event_select_policy",
    "command": "r",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": "(taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid) AND ((current_setting('app.offline_archive_contract_version'::text, true) = '4'::text) OR (EXISTS ( SELECT\n   FROM taptime_server.offline_event_archive_requirements requirement\n  WHERE ((requirement.organization_id = offline_event_reconciliations.organization_id) AND (requirement.work_event_id = offline_event_reconciliations.work_event_id) AND taptime_server.offline_wal_requirement_is_archived_v1(requirement.cluster_system_identifier, requirement.required_wal_lsn, requirement.required_wal_file))))))",
    "check": null,
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.offline_event_reconciliations",
    "policy": "offline_reconciliations_event_insert_policy",
    "command": "a",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": null,
    "check": "(taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid) AND (current_setting('app.offline_archive_contract_version'::text, true) = '4'::text))",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  },
  {
    "table": "taptime_server.customers",
    "policy": "customers_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_nfc_setup_authority_v1(organization_id, id)",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_tags",
    "policy": "nfc_tags_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, id)",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_tags",
    "policy": "nfc_tags_assignment_reassigner_select",
    "command": "r",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, id)",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_tags",
    "policy": "nfc_tags_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL::uuid)",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_assignments",
    "policy": "nfc_assignments_admin_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_assignments",
    "policy": "nfc_assignments_assignment_reassigner_select",
    "command": "r",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_assignments",
    "policy": "nfc_assignments_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_assignments",
    "policy": "nfc_assignments_assignment_reassigner_insert",
    "command": "a",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": null,
    "check": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.nfc_assignments",
    "policy": "nfc_assignments_assignment_reassigner_update",
    "command": "w",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "check": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.time_record_voids",
    "policy": "time_void_read",
    "command": "r",
    "roles": [
      "taptime_time_review_writer"
    ],
    "using": "taptime_server.has_time_void_authority_v1(organization_id, user_id)",
    "check": null,
    "reason": "has_time_void_authority_v1 verbindet die Zielorganisation mit der aktiven Mitgliedschaft und app.organization_id, bevor sie eigene oder verwaltete Zeiten zulässt."
  },
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "admin_setup_receipts_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "(taptime_server.has_current_admin_setup_authority(organization_id) OR ((command_type = ANY (ARRAY['provisionNfcTag'::text, 'reassignNfcTag'::text])) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id) AND (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments assignment\n  WHERE ((assignment.organization_id = admin_setup_command_receipts.organization_id) AND (assignment.id = admin_setup_command_receipts.result_nfc_assignment_id) AND (assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)))) AND ((result_replaced_assignment_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments replaced\n  WHERE ((replaced.organization_id = admin_setup_command_receipts.organization_id) AND (replaced.id = admin_setup_command_receipts.result_replaced_assignment_id)))))))",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "admin_setup_receipts_assignment_reassigner_select",
    "command": "r",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "(taptime_server.has_current_admin_setup_authority(organization_id) OR ((command_type = ANY (ARRAY['provisionNfcTag'::text, 'reassignNfcTag'::text])) AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id) AND (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments assignment\n  WHERE ((assignment.organization_id = admin_setup_command_receipts.organization_id) AND (assignment.id = admin_setup_command_receipts.result_nfc_assignment_id) AND (assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)))) AND ((result_replaced_assignment_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments replaced\n  WHERE ((replaced.organization_id = admin_setup_command_receipts.organization_id) AND (replaced.id = admin_setup_command_receipts.result_replaced_assignment_id)))))))",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.admin_break_tag_command_receipts",
    "policy": "admin_break_receipts_setup_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL::uuid)",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.admin_break_tag_command_receipts",
    "policy": "admin_break_receipts_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL::uuid) AND (actor_user_id = taptime_server.current_user_id()) AND (membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_membership_role = current_setting('app.membership_role'::text, true)) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.work_events",
    "policy": "work_events_assignment_reassigner_select",
    "command": "r",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "(taptime_server.has_current_admin_setup_authority(organization_id) OR (EXISTS ( SELECT 1\n   FROM taptime_server.nfc_assignments assignment\n  WHERE ((assignment.organization_id = work_events.organization_id) AND (assignment.id = work_events.assignment_id)))))",
    "check": null,
    "reason": "Die Zuordnung wird durch die RLS von nfc_assignments sichtbar; ihr organization_id ist mit dem WorkEvent verbunden. Der andere OR-Zweig prüft die Verwaltungsautorität im Anfrage-Mandanten."
  },
  {
    "table": "taptime_server.time_record_voids",
    "policy": "time_void_insert",
    "command": "a",
    "roles": [
      "taptime_time_review_writer"
    ],
    "using": null,
    "check": "(taptime_server.has_time_void_authority_v1(organization_id, user_id) AND (actor_membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_role = current_setting('app.membership_role'::text, true)))",
    "reason": "has_time_void_authority_v1 verbindet die Zielorganisation mit der aktiven Mitgliedschaft und app.organization_id, bevor sie eigene oder verwaltete Zeiten zulässt."
  },
  {
    "table": "taptime_server.time_entries",
    "policy": "time_entries_assignment_reassigner_select",
    "command": "r",
    "roles": [
      "taptime_assignment_reassigner"
    ],
    "using": "(taptime_server.has_current_admin_setup_authority(organization_id) OR (EXISTS ( SELECT 1\n   FROM taptime_server.work_events event\n  WHERE ((event.organization_id = time_entries.organization_id) AND (event.id = time_entries.start_work_event_id)))))",
    "check": null,
    "reason": "Das Start-WorkEvent wird durch dessen RLS sichtbar; sein organization_id ist mit dem Zeiteintrag verbunden. Der andere OR-Zweig prüft die Verwaltungsautorität im Anfrage-Mandanten."
  },
  {
    "table": "taptime_server.work_target_location_assignments",
    "policy": "work_target_locations_admin_setup_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_admin_setup_authority(organization_id) OR ((target_type = 'customer'::text) AND taptime_server.has_current_customer_creation_authority_v1(organization_id, location_id) AND taptime_server.is_current_customer_creation_v1(organization_id, target_id)))",
    "reason": "Jeder freigebende Zweig verlangt Verwaltungs- oder Kundenerstellungsautorität; beide vergleichen die Zielorganisation mit app.organization_id und der aktiven Mitgliedschaft."
  },
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "customer_creation_receipts_select",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "((command_type = 'createCustomer'::text) AND taptime_server.has_current_nfc_setup_authority_v1(organization_id, result_customer_id))",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.admin_setup_command_receipts",
    "policy": "customer_creation_receipts_insert",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "((command_type = 'createCustomer'::text) AND taptime_server.has_current_customer_creation_authority_v1(organization_id, customer_location_id) AND taptime_server.is_current_customer_creation_v1(organization_id, result_customer_id) AND (actor_user_id = taptime_server.current_user_id()) AND (membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_membership_role = current_setting('app.membership_role'::text, true)) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid))",
    "reason": "Jeder freigebende Zweig verlangt Verwaltungs- oder Kundenerstellungsautorität; beide vergleichen die Zielorganisation mit app.organization_id und der aktiven Mitgliedschaft."
  },
  {
    "table": "taptime_server.customer_quota_settings",
    "policy": "quota_setup_read",
    "command": "r",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": "taptime_server.has_current_nfc_setup_authority_v1(organization_id, customer_id)",
    "check": null,
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.customer_quota_settings",
    "policy": "quota_setup_write",
    "command": "a",
    "roles": [
      "taptime_admin_setup"
    ],
    "using": null,
    "check": "(taptime_server.has_current_nfc_setup_authority_v1(organization_id, customer_id) AND (actor_membership_id = (NULLIF(current_setting('app.membership_id'::text, true), ''::text))::uuid) AND (actor_role = current_setting('app.membership_role'::text, true)) AND (actor_role = ANY (ARRAY['administrator'::text, 'standortleitung'::text])) AND (command_id = (NULLIF(current_setting('app.correlation_id'::text, true), ''::text))::uuid))",
    "reason": "Die NFC- bzw. Verwaltungsautorität bindet jeden freigebenden Zweig an app.organization_id und die aktive Mitgliedschaft; weitere Bedingungen verengen auf Kunde, Karte oder Befehl."
  },
  {
    "table": "taptime_server.locations",
    "policy": "locations_project_setup_select",
    "command": "r",
    "roles": [
      "taptime_project_administrator"
    ],
    "using": "taptime_server.has_current_admin_setup_authority(organization_id)",
    "check": null,
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.projects",
    "policy": "projects_project_admin_update",
    "command": "w",
    "roles": [
      "taptime_project_administrator"
    ],
    "using": "(active AND taptime_server.has_current_admin_setup_authority(organization_id))",
    "check": "((NOT active) AND taptime_server.has_current_admin_setup_authority(organization_id))",
    "reason": "has_current_admin_setup_authority verlangt Gleichheit mit app.organization_id sowie die aktive Administrator-Mitgliedschaft aus dem Anfragekontext."
  },
  {
    "table": "taptime_server.work_target_location_assignments",
    "policy": "work_target_locations_project_creation_insert",
    "command": "a",
    "roles": [
      "taptime_project_administrator"
    ],
    "using": null,
    "check": "((target_type = 'project'::text) AND taptime_server.is_current_project_creation_v1(organization_id, target_id, location_id))",
    "reason": "is_current_project_creation_v1 verlangt has_current_admin_setup_authority für die Zielorganisation und die Projekterstellung in derselben Transaktion."
  },
  {
    "table": "taptime_server.offline_skipped_sequences",
    "policy": "offline_skips_actor",
    "command": "*",
    "roles": [
      "taptime_offline_event_ingestor"
    ],
    "using": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "check": "taptime_server.current_offline_actor_matches_v1(organization_id, user_id, membership_id, NULL::uuid)",
    "reason": "current_offline_actor_matches_v1 vergleicht Organisation, Nutzer und Mitgliedschaft mit dem transaktionslokalen Anfragekontext."
  }
] as const;

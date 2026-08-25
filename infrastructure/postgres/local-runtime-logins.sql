-- Local development credentials only. Production login provisioning is part of T-003/T-004.
CREATE ROLE taptime_local_session LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver TO taptime_local_session;

CREATE ROLE taptime_local_read_model LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_employee, taptime_administrator
  TO taptime_local_read_model;

CREATE ROLE taptime_local_lifecycle LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_server_lifecycle TO taptime_local_lifecycle;

CREATE ROLE taptime_local_administration LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_admin_setup TO taptime_local_administration;

CREATE ROLE taptime_local_invitation LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_membership_manager, taptime_password_reset_auditor
  TO taptime_local_invitation;

CREATE ROLE taptime_local_enrollment LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_membership_enrollment_redeemer TO taptime_local_enrollment;

CREATE ROLE taptime_local_reassignment LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_assignment_reassigner TO taptime_local_reassignment;

CREATE ROLE taptime_local_offline_lease LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_offline_lease_issuer TO taptime_local_offline_lease;

CREATE ROLE taptime_local_offline_event LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_offline_event_ingestor TO taptime_local_offline_event;

CREATE ROLE taptime_local_offline_reconciliation LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_offline_reconciliation_reader
  TO taptime_local_offline_reconciliation;

CREATE ROLE taptime_local_time_export LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_time_exporter TO taptime_local_time_export;

CREATE ROLE taptime_local_time_review_read LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_time_review_reader TO taptime_local_time_review_read;

CREATE ROLE taptime_local_time_review_write LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_time_review_writer TO taptime_local_time_review_write;

CREATE ROLE taptime_local_manual_lifecycle LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_server_lifecycle TO taptime_local_manual_lifecycle;

CREATE ROLE taptime_local_mobile_own_time LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_mobile_own_time_reader
  TO taptime_local_mobile_own_time;

CREATE ROLE taptime_local_mobile_target LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_mobile_target_reader TO taptime_local_mobile_target;

CREATE ROLE taptime_local_project_administration LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'taptime-local-only';
GRANT taptime_identity_resolver, taptime_project_administrator
  TO taptime_local_project_administration;

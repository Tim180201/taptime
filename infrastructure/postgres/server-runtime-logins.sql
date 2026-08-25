-- Production passwords are supplied as psql variables and never stored in this file.
-- Example: psql --set=taptime_session_password='<secret>' ... --file=this-file.sql

CREATE ROLE taptime_session LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_session_password';
GRANT taptime_identity_resolver TO taptime_session;

CREATE ROLE taptime_read_model LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_read_model_password';
GRANT taptime_identity_resolver, taptime_employee, taptime_administrator
  TO taptime_read_model;

CREATE ROLE taptime_lifecycle LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_lifecycle_password';
GRANT taptime_identity_resolver, taptime_server_lifecycle TO taptime_lifecycle;

CREATE ROLE taptime_administration LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_administration_password';
GRANT taptime_identity_resolver, taptime_admin_setup TO taptime_administration;

CREATE ROLE taptime_invitation LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_invitation_password';
GRANT taptime_identity_resolver, taptime_membership_manager,
  taptime_password_reset_auditor TO taptime_invitation;

CREATE ROLE taptime_enrollment LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_enrollment_password';
GRANT taptime_membership_enrollment_redeemer TO taptime_enrollment;

CREATE ROLE taptime_reassignment LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_reassignment_password';
GRANT taptime_identity_resolver, taptime_assignment_reassigner TO taptime_reassignment;

CREATE ROLE taptime_offline_lease LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_offline_lease_password';
GRANT taptime_identity_resolver, taptime_offline_lease_issuer TO taptime_offline_lease;

CREATE ROLE taptime_offline_event LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_offline_event_password';
GRANT taptime_identity_resolver, taptime_offline_event_ingestor TO taptime_offline_event;

CREATE ROLE taptime_offline_reconciliation LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_offline_reconciliation_password';
GRANT taptime_identity_resolver, taptime_offline_reconciliation_reader
  TO taptime_offline_reconciliation;

CREATE ROLE taptime_time_export LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_time_export_password';
GRANT taptime_identity_resolver, taptime_time_exporter TO taptime_time_export;

CREATE ROLE taptime_time_review_read LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_time_review_read_password';
GRANT taptime_identity_resolver, taptime_time_review_reader TO taptime_time_review_read;

CREATE ROLE taptime_time_review_write LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_time_review_write_password';
GRANT taptime_identity_resolver, taptime_time_review_writer TO taptime_time_review_write;

CREATE ROLE taptime_manual_lifecycle LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_manual_lifecycle_password';
GRANT taptime_identity_resolver, taptime_server_lifecycle TO taptime_manual_lifecycle;

CREATE ROLE taptime_mobile_own_time LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_mobile_own_time_password';
GRANT taptime_identity_resolver, taptime_mobile_own_time_reader TO taptime_mobile_own_time;

CREATE ROLE taptime_mobile_target LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_mobile_target_password';
GRANT taptime_identity_resolver, taptime_mobile_target_reader TO taptime_mobile_target;

CREATE ROLE taptime_project_administration LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD :'taptime_project_administration_password';
GRANT taptime_identity_resolver, taptime_project_administrator
  TO taptime_project_administration;

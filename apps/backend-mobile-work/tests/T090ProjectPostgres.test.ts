import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { migrate, loadMigrations, applyMigrationSet, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { ProjectAdministrationCoordinator } from '../src/index.js';

const url = process.env.T090_DATABASE_URL ?? process.env.DA5_MOBILE_WORK_DATABASE_URL ?? process.env.OFFLINE_SYNC_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const installer = new Pool({ connectionString: url });
const runtimeUrl = new URL(url);
runtimeUrl.username = 'taptime_t090_project_test'; runtimeUrl.password = 't090-synthetic-only';
const runtime = new Pool({ connectionString: runtimeUrl.toString(), max: 4 });
const issuer = 'https://t090.invalid';
const ids = { org: randomUUID(), otherOrg: randomUUID(), admin: randomUUID(), otherAdmin: randomUUID(), employee: randomUUID(),
  membership: randomUUID(), otherMembership: randomUUID(), employeeMembership: randomUUID(), location: randomUUID(), secondLocation: randomUUID(), foreign: randomUUID() };
const coordinator = new ProjectAdministrationCoordinator(runtime, { async verify(subject) { return { status: 'verified', identity: { issuer, subject } }; } });
const create = (locationId?: string) => ({ accessToken: 'admin', request: { expectedMembershipId: ids.membership, commandId: randomUUID(), projectId: randomUUID(), displayName: 'Neues Projekt', ...(locationId ? { locationId } : {}) } });
beforeAll(async () => {
  await installer.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE; DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installer);
  await installer.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='taptime_t090_project_test') THEN CREATE ROLE taptime_t090_project_test LOGIN; END IF; END $$;
    ALTER ROLE taptime_t090_project_test NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD 't090-synthetic-only';
    GRANT taptime_identity_resolver, taptime_project_administrator TO taptime_t090_project_test`);
}, 30000);
beforeEach(async () => {
  await installer.query('TRUNCATE taptime_server.organizations, taptime_server.users CASCADE');
  await installer.query(`INSERT INTO taptime_server.users(id) VALUES ($1),($2),($3)`, [ids.admin, ids.otherAdmin, ids.employee]);
  await installer.query(`INSERT INTO taptime_server.organizations(id,name) VALUES ($1,'Test'),($2,'Other')`, [ids.org, ids.otherOrg]);
  for (const [subject,user,org,membership,role] of [
    ['admin',ids.admin,ids.org,ids.membership,'administrator'], ['other',ids.otherAdmin,ids.otherOrg,ids.otherMembership,'administrator'], ['employee',ids.employee,ids.org,ids.employeeMembership,'employee'],
  ]) {
    await installer.query(`INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES ($1,$2,$3,$4)`, [randomUUID(),user,issuer,subject]);
    await installer.query(`INSERT INTO taptime_server.memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,$4)`, [membership,user,org,role]);
  }
  await installer.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES ($1,$4,'North'),($2,$4,'South'),($3,$5,'Other')`, [ids.location,ids.secondLocation,ids.foreign,ids.org,ids.otherOrg]);
});
afterAll(async () => { await runtime.end(); await installer.end(); });
async function enable() {
  await installer.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
    SELECT gen_random_uuid(),organization_id,id,CASE WHEN organization_id=$1 THEN $2::uuid ELSE $3::uuid END FROM taptime_server.memberships`, [ids.org,ids.location,ids.foreign]);
  await installer.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,CASE WHEN organization_id=$1 THEN $2::uuid ELSE $3::uuid END FROM taptime_server.work_targets WHERE active`, [ids.org,ids.location,ids.foreign]);
  await installer.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1');
}
it('T090 creates with locations disabled and replays its immutable result after deactivation', async () => {
  const command=create(); const result=await coordinator.createProject(command);
  expect(result).toMatchObject({status:'succeeded',idempotentRetry:false});
  await expect(coordinator.deactivateProject({accessToken:'admin',request:{expectedMembershipId:ids.membership,projectId:command.request.projectId,commandId:randomUUID(),expectedRowVersion:2}})).resolves.toEqual({status:'stale_row_version'});
  await expect(coordinator.deactivateProject({accessToken:'admin',request:{expectedMembershipId:ids.membership,projectId:command.request.projectId,commandId:randomUUID(),expectedRowVersion:1}})).resolves.toMatchObject({status:'succeeded',project:{active:false,rowVersion:2}});
  await expect(coordinator.createProject(command)).resolves.toEqual({...result,idempotentRetry:true});
});
it('T090 creates project, location and receipt atomically with the actual runtime role', async () => {
  await enable(); const command=create(ids.secondLocation); const result=await coordinator.createProject(command);
  expect(result).toMatchObject({status:'succeeded',idempotentRetry:false});
  expect((await installer.query('SELECT location_id FROM taptime_server.work_target_location_assignments WHERE target_id=$1 AND revoked_at IS NULL',[command.request.projectId])).rows).toEqual([{location_id:ids.secondLocation}]);
  expect((await installer.query('SELECT project_location_id FROM taptime_server.project_command_receipts WHERE command_id=$1',[command.request.commandId])).rows).toEqual([{project_location_id:ids.secondLocation}]);
  await expect(coordinator.createProject(command)).resolves.toEqual({...result,idempotentRetry:true});
  await expect(coordinator.createProject({...command,request:{...command.request,locationId:ids.location}})).resolves.toEqual({status:'command_id_conflict'});
  await installer.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1');
  await expect(coordinator.createProject(command)).resolves.toEqual({...result,idempotentRetry:true});
});
it('T090 enforces mode, active location, tenant and administrator boundaries', async () => {
  await expect(coordinator.createProject(create(ids.location))).resolves.toEqual({status:'invalid_request'});
  await enable();
  await expect(coordinator.createProject(create())).resolves.toEqual({status:'location_required'});
  await expect(coordinator.createProject(create(ids.foreign))).resolves.toEqual({status:'forbidden'});
  await installer.query('UPDATE taptime_server.locations SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1',[ids.secondLocation]);
  await expect(coordinator.createProject(create(ids.secondLocation))).resolves.toEqual({status:'forbidden'});
  const command=create(ids.location);
  await expect(coordinator.createProject({...command,accessToken:'other'})).resolves.toEqual({status:'forbidden'});
  await expect(coordinator.createProject({...command,accessToken:'employee',request:{...command.request,expectedMembershipId:ids.employeeMembership}})).resolves.toEqual({status:'forbidden'});
  await installer.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1",[ids.employeeMembership]);
  await expect(coordinator.createProject({...command,accessToken:'employee',request:{...command.request,expectedMembershipId:ids.employeeMembership}})).resolves.toEqual({status:'forbidden'});
});
it('T090 serializes simultaneous exact retries into one project', async () => {
  await enable(); const command=create(ids.location);
  const results=await Promise.all([coordinator.createProject(command),coordinator.createProject(command)]);
  expect(results.map(result=>result.status)).toEqual(['succeeded','succeeded']);
  expect(results.filter(result=>result.status==='succeeded'&&result.idempotentRetry)).toHaveLength(1);
});

it('T090 rejects project_in_use through the real runtime role', async () => {
  const command=create();
  expect((await coordinator.createProject(command)).status).toBe('succeeded');
  const client=await installer.connect();
  try {
    const event=randomUUID(), entry=randomUUID();
    await client.query('BEGIN');
    await client.query(`INSERT INTO taptime_server.work_events
      (id,organization_id,target_type,target_customer_id,triggered_by_user_id,occurred_at,content_hash,content_hash_algorithm,content_hash_version,trigger_type)
      VALUES ($1,$2,'project',$3,$4,transaction_timestamp()-interval '1 hour',repeat('a',64),'sha256',2,'manual')`,
      [event,ids.org,command.request.projectId,ids.admin]);
    await client.query(`INSERT INTO taptime_server.time_entries
      (id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
      VALUES ($1,$2,$3,'project',$4,'started',$5,transaction_timestamp()-interval '1 hour','manual')`,[entry,ids.org,ids.admin,command.request.projectId,event]);
    await client.query(`INSERT INTO taptime_server.canonical_decisions
      (work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
      VALUES ($1,$2,$3,'project',$4,'time_entry_started',$5,'t090-test','{}')`,[event,ids.org,ids.admin,command.request.projectId,entry]);
    await client.query('COMMIT');
  } finally { await client.query('ROLLBACK'); client.release(); }
  await expect(coordinator.deactivateProject({accessToken:'admin',request:{expectedMembershipId:ids.membership,projectId:command.request.projectId,commandId:randomUUID(),expectedRowVersion:1}})).resolves.toEqual({status:'project_in_use'});
});
it('T090 deactivation revokes the binding, preserving the original receipt and audit', async () => {
  await enable(); const command=create(ids.location); const created=await coordinator.createProject(command);
  expect(created.status).toBe('succeeded');
  const deactivate={accessToken:'admin',request:{expectedMembershipId:ids.membership,projectId:command.request.projectId,commandId:randomUUID(),expectedRowVersion:1}};
  const result=await coordinator.deactivateProject(deactivate);
  expect(result).toMatchObject({status:'succeeded',project:{active:false}});
  await expect(coordinator.deactivateProject(deactivate)).resolves.toEqual({...result,idempotentRetry:true});
  expect((await installer.query('SELECT revoked_at IS NOT NULL AS revoked FROM taptime_server.work_target_location_assignments WHERE target_id=$1',[command.request.projectId])).rows).toEqual([{revoked:true}]);
  expect((await installer.query('SELECT event_type FROM taptime_server.audit_events WHERE correlation_id=$1 ORDER BY event_type',[command.request.commandId])).rows).toEqual([{event_type:'ProjectCreated'},{event_type:'WorkTargetLocationAssigned'}]);
  await expect(coordinator.createProject(command)).resolves.toEqual({...created,idempotentRetry:true});
});
it('T090 rolls all writes back on a CHECK failure and maps 23514 to invalid_request', async () => {
  await enable(); const command=create(ids.location);
  await installer.query(`CREATE FUNCTION taptime_server.t090_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic' USING ERRCODE='23514'; END $$;
    CREATE TRIGGER t090_fail BEFORE INSERT ON taptime_server.project_command_receipts FOR EACH ROW EXECUTE FUNCTION taptime_server.t090_fail_receipt()`);
  try { await expect(coordinator.createProject(command)).resolves.toEqual({status:'invalid_request'}); }
  finally { await installer.query('DROP TRIGGER t090_fail ON taptime_server.project_command_receipts; DROP FUNCTION taptime_server.t090_fail_receipt()'); }
  expect((await installer.query('SELECT 1 FROM taptime_server.projects WHERE id=$1',[command.request.projectId])).rows).toEqual([]);
  expect((await installer.query('SELECT 1 FROM taptime_server.audit_events WHERE correlation_id=$1',[command.request.commandId])).rows).toEqual([]);
  expect((await installer.query('SELECT 1 FROM taptime_server.work_target_location_assignments WHERE target_id=$1',[command.request.projectId])).rows).toEqual([]);
});
it('T090 SQL denies foreign bindings and binding an existing project with the project role', async () => {
  await enable(); const command=create(ids.location); await coordinator.createProject(command);
  for (const foreign of [false,true]) {
    const client=await runtime.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true),set_config('app.correlation_id',$4,true)`,[ids.org,ids.admin,ids.membership,randomUUID()]);
      await client.query('SET LOCAL ROLE taptime_project_administrator');
      const projectId=foreign?randomUUID():command.request.projectId;
      if(foreign) await client.query(`INSERT INTO taptime_server.projects(id,organization_id,display_name) VALUES ($1,$2,'SQL project')`,[projectId,ids.org]);
      await expect(client.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
        VALUES ($1,$2,'project',$3,$4)`,[randomUUID(),ids.org,projectId,foreign?ids.foreign:ids.secondLocation])).rejects.toMatchObject({code:'42501'});
    } finally { await client.query('ROLLBACK');client.release(); }
  }
});
it('T090 SQL cannot deactivate, reactivate and move an existing project through creation rights', async () => {
  await enable(); const command=create(ids.location); await coordinator.createProject(command);
  const client=await runtime.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true),set_config('app.correlation_id',$4,true)`,[ids.org,ids.admin,ids.membership,randomUUID()]);
    await client.query('SET LOCAL ROLE taptime_project_administrator');
    await client.query(`UPDATE taptime_server.projects SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1`,[command.request.projectId]);
    const reactivated=await client.query(`UPDATE taptime_server.projects SET active=true,deactivated_at=NULL,row_version=row_version+1 WHERE id=$1`,[command.request.projectId]);
    expect(reactivated.rowCount).toBe(0);
    await expect(client.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
      VALUES ($1,$2,'project',$3,$4)`,[randomUUID(),ids.org,command.request.projectId,ids.secondLocation])).rejects.toMatchObject({code:'23514'});
  } finally { await client.query('ROLLBACK');client.release(); }
});
it('T090 SQL cannot refresh an existing active project xmin through a no-op update', async () => {
  await enable(); const command=create(ids.location); await coordinator.createProject(command);
  const client=await runtime.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)`,[ids.org,ids.admin,ids.membership]);
    await client.query('SET LOCAL ROLE taptime_project_administrator');
    await expect(client.query('UPDATE taptime_server.projects SET active=active WHERE id=$1',[command.request.projectId])).rejects.toMatchObject({code:'42501'});
  } finally { await client.query('ROLLBACK');client.release(); }
});
it('T090 upgrades 038 without changing existing projects, bindings, receipts or audit', async () => {
  await installer.query(`DROP SCHEMA ${B3_SCHEMA} CASCADE; DROP TABLE ${B3_MIGRATION_TABLE}`);
  const migrations=await loadMigrations();
  await applyMigrationSet(installer,migrations.filter(m=>m.version<'039'));
  await installer.query(`INSERT INTO taptime_server.users(id) VALUES ($1);`,[ids.admin]);
  await installer.query(`INSERT INTO taptime_server.organizations(id,name) VALUES ($1,'Upgrade')`,[ids.org]);
  await installer.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role) VALUES ($1,$2,$3,'administrator')`,[ids.membership,ids.org,ids.admin]);
  const project=randomUUID();
  await installer.query(`INSERT INTO taptime_server.projects(id,organization_id,display_name) VALUES ($1,$2,'Existing')`,[project,ids.org]);
  await installer.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES ($1,$2,'Existing location')`,[ids.location,ids.org]);
  await installer.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES ($1,$2,'project',$3,$4)`,[randomUUID(),ids.org,project,ids.location]);
  await installer.query(`INSERT INTO taptime_server.project_command_receipts(organization_id,command_id,actor_user_id,actor_membership_id,command_type,request_hash,project_id,result_display_name,result_active,result_row_version)
    VALUES ($1,$2,$3,$4,'create',repeat('a',64),$5,'Existing',true,1)`,[ids.org,randomUUID(),ids.admin,ids.membership,project]);
  const snapshot=async()=>({ projects:(await installer.query('SELECT * FROM taptime_server.projects ORDER BY id')).rows,
    bindings:(await installer.query('SELECT * FROM taptime_server.work_target_location_assignments ORDER BY id')).rows,
    receipts:(await installer.query('SELECT command_id,request_hash,project_id,result_display_name,result_active,result_row_version FROM taptime_server.project_command_receipts ORDER BY command_id')).rows,
    audit:(await installer.query('SELECT * FROM taptime_server.audit_events ORDER BY id')).rows });
  const before=await snapshot(); await applyMigrationSet(installer,migrations); expect(await snapshot()).toEqual(before);
});

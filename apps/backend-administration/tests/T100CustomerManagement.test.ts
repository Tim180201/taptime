import {ManualLifecycleIngestionCoordinator,ServerCanonicalLifecycleIngestionCoordinator,type LifecycleIngestionCommand} from '@taptime/backend-lifecycle';
import type {SupabaseJwtAccessTokenVerifier} from '@taptime/backend-identity';
import {CustomerId,OrganizationId,NfcAssignmentId,NfcTagId,WorkEventId,createTimestamp,customerAssignmentTarget} from '@taptime/core';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { migrate, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { AdminWriteSessionCoordinator } from '../src/index.js';
import { seedC3C, truncateC3C, ids, membershipIds, fixtureTokens, fixtureAccessTokenVerifier } from './fixtures.js';
const pool = new Pool({ connectionString: process.env.C3C_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c', max: 5 });
const setup = new AdminWriteSessionCoordinator(pool, fixtureAccessTokenVerifier);
const admin = { accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA };
const rename = (displayName = 'Neuer Name') => ({ ...admin, commandId: randomUUID(), customerId: ids.customerA, action: 'rename' as const, displayName });
const deactivate = () => ({ ...admin, commandId: randomUUID(), customerId: ids.customerA, action: 'deactivate' as const });
beforeAll(async () => { await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`); await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`); await migrate(pool); });
beforeEach(async () => { await truncateC3C(pool); await seedC3C(pool); });
afterAll(async () => { await pool.end(); });
it('normalizes names, permits duplicates and replays the original command after subsequent renames', async () => {
  const old = (await pool.query('SELECT display_name FROM taptime_server.customers WHERE id=$1', [ids.customerA])).rows[0].display_name;
  const name = 'Bestehender Kunde';
  await setup.createCustomer({...admin,commandId:randomUUID(),displayName:name});
  const command = rename(`  ${name}  `);
  expect(await setup.manageCustomer(command)).toEqual({ status: 'succeeded' });
  expect(await setup.manageCustomer(rename('Später'))).toEqual({ status: 'succeeded' });
  expect(await setup.manageCustomer(command)).toEqual({ status: 'succeeded' });
  expect(await setup.manageCustomer({ ...command, displayName: 'Anders' })).toEqual({ status: 'command_id_conflict' });
  expect((await pool.query('SELECT payload FROM taptime_server.audit_events WHERE correlation_id=$1', [command.commandId])).rows).toEqual([{payload: expect.objectContaining({ oldName: old, newName: name })}]);
  expect((await pool.query('SELECT display_name FROM taptime_server.work_targets WHERE target_id=$1', [ids.customerA])).rows).toEqual([{display_name:'Später'}]);
});
it('creation remains replayable after renaming', async () => {
  const command = { ...admin, commandId: randomUUID(), displayName: 'Original' };
  const created = await setup.createCustomer(command);
  if (created.status !== 'succeeded') throw new Error('creation failed');
  expect(await setup.manageCustomer({...rename(), customerId: created.customer.id})).toEqual({status:'succeeded'});
  expect(await setup.createCustomer(command)).toEqual({...created,idempotentRetry:true});
});
it.each(['',' '.repeat(10),'x'.repeat(121)])('rejects invalid name %j', async name => {
  expect(await setup.manageCustomer(rename(name))).toEqual({status:'invalid_request'});
});
it('rejects employees and other tenants without an audit', async () => {
  expect(await setup.manageCustomer({...rename(), accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA})).toEqual({status:'forbidden'});
  expect(await setup.manageCustomer({...rename(),customerId:ids.customerB})).toEqual({status:'forbidden'});
});
it('deactivates customer and assignments atomically, keeps history and replays deletion', async () => {
  const command = deactivate();
  await expect(setup.manageCustomer(command,{beforeCommit(){throw new Error('injected');}})).rejects.toThrow('injected');
  expect((await pool.query('SELECT active FROM taptime_server.customers WHERE id=$1',[ids.customerA])).rows[0].active).toBe(true);
  expect(await setup.manageCustomer(command)).toEqual({status:'succeeded'});
  expect(await setup.manageCustomer(command)).toEqual({status:'succeeded'});
  expect((await pool.query('SELECT active,valid_to FROM taptime_server.nfc_assignments WHERE id=$1',[ids.assignmentA])).rows).toEqual([{active:false,valid_to:expect.any(Date)}]);
  const projection = await setup.readSetupProjection({...admin,limit:20,cursor:null});
  expect(projection.status).toBe('succeeded');
  if(projection.status==='succeeded') expect(projection.customers.map(c=>c.id)).not.toContain(ids.customerA);
  expect(await setup.manageCustomer(rename())).toEqual({status:'customer_unavailable'});
});

const lifecycle=new ServerCanonicalLifecycleIngestionCoordinator(pool,fixtureAccessTokenVerifier as SupabaseJwtAccessTokenVerifier,{async requireOffsiteArchive(){return {requiredWalFile:'000000010000000000000000',offsiteArchived:true};}});
const event=():LifecycleIngestionCommand=>({accessToken:fixtureTokens.employeeA,requestedOrganizationId:OrganizationId(ids.organizationA),
 workEvent:{id:WorkEventId(randomUUID()),assignmentId:NfcAssignmentId(ids.assignmentA),nfcTagId:NfcTagId(ids.tagAssignedA),target:customerAssignmentTarget(CustomerId(ids.customerA)),occurredAt:createTimestamp(new Date().toISOString())},receipt:{id:randomUUID(),attemptNumber:1}});
it('running time of any person blocks deletion without changing customer, assignment or audit',async()=>{
 expect(await lifecycle.ingest(event(),membershipIds.employeeA)).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
 const command=deactivate();
 expect(await setup.manageCustomer(command)).toEqual({status:'running_time'});
 expect((await pool.query('SELECT active FROM taptime_server.customers WHERE id=$1',[ids.customerA])).rows).toEqual([{active:true}]);
 expect((await pool.query('SELECT 1 FROM taptime_server.audit_events WHERE correlation_id=$1',[command.commandId])).rows).toEqual([]);
});
function latch(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
it.each(['start','delete'] as const)('serializes concurrent NFC start/delete when %s wins the lock',async first=>{
 const locked=latch(),release=latch();
 if(first==='start'){
  const start=lifecycle.ingest(event(),membershipIds.employeeA,{afterConfigurationLocked:async()=>{locked.resolve();await release.promise;}});
  await Promise.race([locked.promise,start.then(()=>{throw new Error('Start completed before lock hook');})]);
  const deletion=setup.manageCustomer(deactivate());
  release.resolve();
  expect(await start).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
  expect(await deletion).toEqual({status:'running_time'});
 }else{
  const deletion=setup.manageCustomer(deactivate(),{beforeCommit:async()=>{locked.resolve();await release.promise;}});
  await locked.promise;
  const start=lifecycle.ingest(event(),membershipIds.employeeA);
  release.resolve();
  expect(await deletion).toEqual({status:'succeeded'});
  expect(await start).not.toMatchObject({decision:{status:'time_entry_started'}});
  expect((await pool.query('SELECT 1 FROM taptime_server.time_entries')).rows).toEqual([]);
 }
});
it('inspects assigned, break and unassigned tags read-only; a freed tag is reusable once',async()=>{
 const payload=(await pool.query('SELECT payload_value FROM taptime_server.nfc_tags WHERE id=$1',[ids.tagAssignedA])).rows[0].payload_value;
 const snapshot=async()=>({audit:(await pool.query('SELECT * FROM taptime_server.audit_events ORDER BY id')).rows,events:(await pool.query('SELECT * FROM taptime_server.work_events')).rows,tags:(await pool.query('SELECT * FROM taptime_server.nfc_assignments ORDER BY id')).rows});
 expect(await setup.provisionBreakNfcTag({...admin,commandId:randomUUID(),displayName:'Pause',canonicalPayload:'nfc:uid:v1:CC'})).toMatchObject({status:'succeeded'});
 const before=await snapshot();
 expect(await setup.inspectTag({...admin,canonicalPayload:'nfc:uid:v1:CC'})).toEqual({status:'succeeded',assignment:'break',customerName:null,locationName:null});
 expect(await setup.inspectTag({...admin,canonicalPayload:payload})).toMatchObject({status:'succeeded',assignment:'customer',customerName:expect.any(String),locationName:null});
 expect(await setup.inspectTag({...admin,canonicalPayload:'nfc:uid:v1:FFFFFF'})).toEqual({status:'succeeded',assignment:'unassigned',customerName:null,locationName:null});
 expect(await snapshot()).toEqual(before);
 expect(await setup.manageCustomer(deactivate())).toEqual({status:'succeeded'});
 expect(await setup.inspectTag({...admin,canonicalPayload:payload})).toMatchObject({status:'succeeded',assignment:'unassigned'});
 const created=await setup.createCustomer({...admin,commandId:randomUUID(),displayName:'Zweites Ziel'});
 if(created.status!=='succeeded')throw new Error('creation');
 const request={...admin,commandId:randomUUID(),customerId:created.customer.id,canonicalPayload:payload,displayName:'Wiederverwendet'};
 expect(await setup.reuseTag(request)).toMatchObject({status:'succeeded'});
 expect(await setup.reuseTag(request)).toMatchObject({status:'succeeded'});
 expect(await setup.reuseTag({...request,commandId:randomUUID()})).toEqual({status:'tag_payload_already_registered'});
 expect((await pool.query('SELECT target_customer_id FROM taptime_server.nfc_assignments WHERE nfc_tag_id=$1 AND active',[ids.tagAssignedA])).rows).toEqual([{target_customer_id:created.customer.id}]);
 expect((await pool.query('SELECT active FROM taptime_server.nfc_assignments WHERE id=$1',[ids.assignmentA])).rows).toEqual([{active:false}]);
});
it('manager can rename/delete own location customers, but SQL rejects a different location',async()=>{
 const locA=randomUUID(),locB=randomUUID();
 await pool.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Nord'),($2,$3,'Süd')",[locA,locB,ids.organizationA]);
 await pool.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1",[ids.membershipEmployeeA]);
 await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)',[randomUUID(),ids.organizationA,ids.membershipEmployeeA,locA]);
 await pool.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) VALUES($1,$2,'customer',$3,$4)",[randomUUID(),ids.organizationA,ids.customerA,locA]);
 await pool.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) SELECT gen_random_uuid(),organization_id,id,$2 FROM taptime_server.memberships WHERE organization_id=$1',[ids.organizationA,locA]);
 await pool.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) SELECT gen_random_uuid(),organization_id,target_type,target_id,$2 FROM taptime_server.work_targets WHERE organization_id=$1 AND active AND target_id<>$3",[ids.organizationA,locA,ids.customerA]);
 await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
 const manager={accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA};
 const other=await setup.createCustomer({...admin,commandId:randomUUID(),displayName:'Andere',locationId:locB});
 if(other.status!=='succeeded')throw new Error('creation');
 expect(await setup.manageCustomer({...rename(),...manager})).toEqual({status:'succeeded'});
 expect(await setup.manageCustomer({...rename(),...manager,customerId:other.customer.id})).toEqual({status:'forbidden'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','standortleitung',true),set_config('app.correlation_id',$4,true)",[ids.organizationA,ids.employeeA,ids.membershipEmployeeA,randomUUID()]);
  await client.query('SET LOCAL ROLE taptime_admin_setup');
  await expect(client.query("SELECT taptime_server.manage_customer_v1($1,'rename','Verboten',current_setting('app.correlation_id')::uuid)",[other.customer.id])).rejects.toMatchObject({code:'42501'});
 }finally{await client.query('ROLLBACK');client.release();}
 const command={...deactivate(),...manager};
 expect(await setup.manageCustomer(command)).toEqual({status:'succeeded'});
 expect(await setup.manageCustomer(command)).toEqual({status:'succeeded'});
});

it('manual start and deletion share the target lock',async()=>{
 const manual=new ManualLifecycleIngestionCoordinator(pool,fixtureAccessTokenVerifier,{async requireOffsiteArchive(){return {requiredWalFile:'000000010000000000000000',offsiteArchived:true};}});
 const locked=latch(),release=latch();
 const deletion=setup.manageCustomer(deactivate(),{beforeCommit:async()=>{locked.resolve();await release.promise;}});
 await locked.promise;
 const start=manual.ingestManual({accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA,workEvent:{id:WorkEventId(randomUUID()),target:customerAssignmentTarget(CustomerId(ids.customerA))},receipt:{id:randomUUID(),attemptNumber:1}});
 release.resolve();
 expect(await deletion).toEqual({status:'succeeded'});
 expect(await start).not.toMatchObject({decision:{status:'time_entry_started'}});
 expect((await pool.query('SELECT 1 FROM taptime_server.time_entries')).rows).toEqual([]);
});

it('a freed customer tag can become a break tag, with idempotency and no active-tag overwrite',async()=>{
 const canonicalPayload=(await pool.query('SELECT payload_value FROM taptime_server.nfc_tags WHERE id=$1',[ids.tagAssignedA])).rows[0].payload_value;
 const request={...admin,commandId:randomUUID(),canonicalPayload,displayName:'Pause'};
 expect(await setup.reuseTag(request)).toEqual({status:'tag_payload_already_registered'});
 expect(await setup.manageCustomer(deactivate())).toEqual({status:'succeeded'});
 expect(await setup.reuseTag(request)).toMatchObject({status:'succeeded'});
 expect(await setup.reuseTag(request)).toMatchObject({status:'succeeded'});
 expect(await setup.reuseTag({...request,commandId:randomUUID()})).toEqual({status:'tag_payload_already_registered'});
 expect(await setup.reuseTag({...request,customerId:CustomerId(ids.customerB)})).toEqual({status:'command_id_conflict'});
 expect(await setup.reuseTag({...request,commandId:randomUUID(),customerId:CustomerId(ids.customerB)})).toEqual({status:'assignment_target_unavailable'});
 expect((await pool.query('SELECT assignment_type,target_type,target_customer_id FROM taptime_server.nfc_assignments WHERE nfc_tag_id=$1 AND active',[ids.tagAssignedA])).rows).toEqual([{assignment_type:'break',target_type:null,target_customer_id:null}]);
 expect(await setup.inspectTag({...admin,canonicalPayload})).toMatchObject({status:'succeeded',assignment:'break'});
});

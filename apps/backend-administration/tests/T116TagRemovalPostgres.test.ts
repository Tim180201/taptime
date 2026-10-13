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
const lifecycle=new ServerCanonicalLifecycleIngestionCoordinator(pool,fixtureAccessTokenVerifier as SupabaseJwtAccessTokenVerifier,{async requireOffsiteArchive(){return {requiredWalFile:'000000010000000000000000',offsiteArchived:true};}});
const event=():LifecycleIngestionCommand=>({accessToken:fixtureTokens.employeeA,requestedOrganizationId:OrganizationId(ids.organizationA),
 workEvent:{id:WorkEventId(randomUUID()),assignmentId:NfcAssignmentId(ids.assignmentA),nfcTagId:NfcTagId(ids.tagAssignedA),target:customerAssignmentTarget(CustomerId(ids.customerA)),occurredAt:createTimestamp(new Date().toISOString())},receipt:{id:randomUUID(),attemptNumber:1}});

const removal=()=>({...admin,commandId:randomUUID(),nfcTagId:ids.tagAssignedA,expectedAssignmentId:ids.assignmentA});
async function payload(){return (await pool.query('SELECT payload_value FROM taptime_server.nfc_tags WHERE id=$1',[ids.tagAssignedA])).rows[0].payload_value;}
it('closes exactly the assignment, leaves card/customer/history, and acknowledges the original command',async()=>{
 const command=removal();const before=(await pool.query('SELECT * FROM taptime_server.nfc_assignments WHERE id=$1',[ids.assignmentA])).rows[0];
 const result=await setup.removeTag(command);expect(result).toMatchObject({status:'succeeded',removedAt:expect.any(String)});
 expect(await setup.removeTag(command)).toEqual(result);
 expect(await setup.removeTag({...command,expectedAssignmentId:randomUUID()})).toEqual({status:'command_id_conflict'});
 expect(await setup.removeTag(removal())).toEqual({status:'assignment_changed'});
 const after=(await pool.query('SELECT * FROM taptime_server.nfc_assignments WHERE id=$1',[ids.assignmentA])).rows[0];
 expect(after).toMatchObject({active:false,row_version:String(BigInt(before.row_version)+1n),valid_to:expect.any(Date),target_customer_id:ids.customerA,nfc_tag_id:ids.tagAssignedA});
 expect((await pool.query('SELECT active FROM taptime_server.customers WHERE id=$1',[ids.customerA])).rows[0].active).toBe(true);
 expect((await pool.query("SELECT payload FROM taptime_server.audit_events WHERE correlation_id=$1 AND event_type='NfcTagRemoved'",[command.commandId])).rows).toEqual([{payload:{request:{nfcTagId:command.nfcTagId,expectedAssignmentId:command.expectedAssignmentId,membershipId:command.expectedMembershipId},result}}]);
 const canonicalPayload=await payload();
 expect(await setup.inspectTagV2({...admin,canonicalPayload})).toEqual({status:'succeeded',assignment:'unassigned',customerName:null,locationName:null,nfcTagId:null,activeAssignmentId:null});
 const customer=await setup.createCustomer({...admin,commandId:randomUUID(),displayName:'Neues Ziel'});if(customer.status!=='succeeded')throw new Error('customer');
 expect(await setup.reuseTag({...admin,commandId:randomUUID(),customerId:customer.customer.id,canonicalPayload,displayName:'Karte'})).toMatchObject({status:'succeeded'});
 expect(await setup.removeTag(command)).toEqual(result);
 expect((await pool.query('SELECT target_customer_id FROM taptime_server.nfc_assignments WHERE nfc_tag_id=$1 AND active',[ids.tagAssignedA])).rows).toEqual([{target_customer_id:customer.customer.id}]);
});
it('rejects stale assignments, employees, other tenants, malformed input and invalid identity',async()=>{
 expect(await setup.removeTag({...removal(),expectedAssignmentId:randomUUID()})).toEqual({status:'assignment_changed'});
 expect(await setup.removeTag({...removal(),accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA})).toEqual({status:'forbidden'});
 expect(await setup.removeTag({...removal(),accessToken:fixtureTokens.adminB,expectedMembershipId:membershipIds.adminB})).toEqual({status:'forbidden'});
 expect(await setup.removeTag({...removal(),accessToken:fixtureTokens.rejected})).toEqual({status:'unauthorized'});
 expect(await setup.removeTag({...removal(),expectedAssignmentId:'invalid'})).toEqual({status:'invalid_request'});
 expect((await pool.query("SELECT 1 FROM taptime_server.audit_events WHERE event_type='NfcTagRemoved'")).rows).toEqual([]);
});
it('inspect v2 exposes both IDs only for an assigned visible card; v1 remains unchanged',async()=>{
 const canonicalPayload=await payload();const v1=await setup.inspectTag({...admin,canonicalPayload});
 expect(v1).toEqual({status:'succeeded',assignment:'customer',customerName:expect.any(String),locationName:null});
 expect(await setup.inspectTagV2({...admin,canonicalPayload})).toEqual({...v1,nfcTagId:ids.tagAssignedA,activeAssignmentId:ids.assignmentA});
 for(const canonicalPayload of ['nfc:uid:v1:FFFFFFFF','nfc:uid:v1:BB'])expect(await setup.inspectTagV2({...admin,canonicalPayload})).toEqual({status:'succeeded',assignment:'unassigned',customerName:null,locationName:null,nfcTagId:null,activeAssignmentId:null});
});
it('manager removes cards in own scope and break cards, without leaking other scopes',async()=>{
 const locA=randomUUID(),locB=randomUUID();
 await pool.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Nord'),($2,$3,'Süd')",[locA,locB,ids.organizationA]);
 await pool.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1",[ids.membershipEmployeeA]);
 await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)',[randomUUID(),ids.organizationA,ids.membershipEmployeeA,locA]);
 await pool.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) VALUES($1,$2,'customer',$3,$4)",[randomUUID(),ids.organizationA,ids.customerA,locA]);
 await pool.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) SELECT gen_random_uuid(),organization_id,id,$2 FROM taptime_server.memberships WHERE organization_id=$1',[ids.organizationA,locA]);
 await pool.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) SELECT gen_random_uuid(),organization_id,target_type,target_id,$2 FROM taptime_server.work_targets WHERE organization_id=$1 AND active AND target_id<>$3",[ids.organizationA,locA,ids.customerA]);
 await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
 const manager={accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA};

 const other=await setup.createCustomer({...admin,commandId:randomUUID(),displayName:'Andere',locationId:locB});if(other.status!=='succeeded')throw new Error('customer');
 expect(await setup.provisionNfcTag({...admin,commandId:randomUUID(),customerId:other.customer.id,displayName:'Andere Karte',canonicalPayload:'nfc:uid:v1:CC'})).toMatchObject({status:'succeeded'});
 const foreign=(await pool.query("SELECT a.id,a.nfc_tag_id FROM taptime_server.nfc_assignments a JOIN taptime_server.nfc_tags t ON t.id=a.nfc_tag_id WHERE t.payload_value='nfc:uid:v1:CC' AND a.active")).rows[0];
 expect(await setup.removeTag({...removal(),...manager,nfcTagId:foreign.nfc_tag_id,expectedAssignmentId:foreign.id})).toEqual({status:'forbidden'});
 expect(await setup.inspectTagV2({...manager,canonicalPayload:'nfc:uid:v1:CC'})).toEqual({status:'succeeded',assignment:'unassigned',customerName:null,locationName:null,nfcTagId:null,activeAssignmentId:null});
 expect(await setup.removeTag({...removal(),...manager})).toMatchObject({status:'succeeded'});
 expect(await setup.provisionBreakNfcTag({...admin,commandId:randomUUID(),displayName:'Pause',canonicalPayload:'nfc:uid:v1:DD'})).toMatchObject({status:'succeeded'});
 const pause=await setup.inspectTagV2({...manager,canonicalPayload:'nfc:uid:v1:DD'});expect(pause).toMatchObject({status:'succeeded',assignment:'break',nfcTagId:expect.any(String),activeAssignmentId:expect.any(String)});
 if(pause.status!=='succeeded'||!pause.nfcTagId||!pause.activeAssignmentId)throw new Error('pause');
 expect(await setup.removeTag({...removal(),...manager,nfcTagId:pause.nfcTagId,expectedAssignmentId:pause.activeAssignmentId})).toMatchObject({status:'succeeded'});
});
function latch(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
async function remainsPending(operation:Promise<unknown>){
 let settled=false;void operation.then(()=>{settled=true;},()=>{settled=true;});
 await new Promise(resolve=>setTimeout(resolve,75));expect(settled).toBe(false);
}
it.each(['start','remove'] as const)('serializes card start/remove when %s acquires the shared target lock first',async first=>{
 const locked=latch(),release=latch();
 if(first==='start'){
  const start=lifecycle.ingest(event(),membershipIds.employeeA,{afterConfigurationLocked:async()=>{locked.resolve();await release.promise;}});
  await Promise.race([locked.promise,start.then(()=>{throw new Error('start completed before gate');})]);
  let remove!:ReturnType<typeof setup.removeTag>;
  try{remove=setup.removeTag(removal());await remainsPending(remove);}finally{release.resolve();await Promise.allSettled([start,...(remove?[remove]:[])]);}
  expect(await start).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});expect(await remove).toMatchObject({status:'succeeded'});
  expect((await pool.query("SELECT status FROM taptime_server.time_entries")).rows).toEqual([{status:'started'}]);
 }else{
  const remove=setup.removeTag(removal(),{beforeCommit:async()=>{locked.resolve();await release.promise;}});
  await Promise.race([locked.promise,remove.then(()=>{throw new Error('remove completed before gate');})]);
  let start!:ReturnType<typeof lifecycle.ingest>;
  try{start=lifecycle.ingest(event(),membershipIds.employeeA);await remainsPending(start);}finally{release.resolve();await Promise.allSettled([remove,...(start?[start]:[])]);}
  expect(await remove).toMatchObject({status:'succeeded'});expect(await start).not.toMatchObject({decision:{status:'time_entry_started'}});
  expect((await pool.query('SELECT 1 FROM taptime_server.time_entries')).rows).toEqual([]);
 }
});
it.each(['delete','remove'] as const)('serializes customer deletion/remove without deadlock when %s wins',async first=>{
 const locked=latch(),release=latch();const controls={beforeCommit:async()=>{locked.resolve();await release.promise;}};
 const winner=first==='delete'?setup.manageCustomer(deactivate(),controls):setup.removeTag(removal(),controls);
 await Promise.race([locked.promise,winner.then(()=>{throw new Error('winner completed before gate');})]);
 let loser!:ReturnType<typeof setup.removeTag>|ReturnType<typeof setup.manageCustomer>;
 try{loser=first==='delete'?setup.removeTag(removal()):setup.manageCustomer(deactivate());await remainsPending(loser);}finally{release.resolve();await Promise.allSettled([winner,...(loser?[loser]:[])]);}
 expect(await winner).toMatchObject({status:'succeeded'});expect(await loser).toMatchObject({status:first==='delete'?'assignment_changed':'succeeded'});
});

const manual=new ManualLifecycleIngestionCoordinator(pool,fixtureAccessTokenVerifier,{async requireOffsiteArchive(){return {requiredWalFile:'000000010000000000000000',offsiteArchived:true};}});
it.each(['work','break'] as const)('removing a %s card leaves running time and permits ending it online',async type=>{
 const started=await lifecycle.ingest(event(),membershipIds.employeeA);expect(started).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
 let command=removal();
 if(type==='break'){
  await setup.provisionBreakNfcTag({...admin,commandId:randomUUID(),displayName:'Pause',canonicalPayload:'nfc:uid:v1:DD'});
  const pause=await setup.inspectTagV2({...admin,canonicalPayload:'nfc:uid:v1:DD'});if(pause.status!=='succeeded'||!pause.nfcTagId||!pause.activeAssignmentId)throw new Error('pause');
  expect(await lifecycle.ingest({accessToken:fixtureTokens.employeeA,requestedOrganizationId:OrganizationId(ids.organizationA),workEvent:{id:WorkEventId(randomUUID()),assignmentId:NfcAssignmentId(pause.activeAssignmentId),nfcTagId:NfcTagId(pause.nfcTagId),subject:{type:'break'},occurredAt:createTimestamp(new Date().toISOString())},receipt:{id:randomUUID(),attemptNumber:1}},membershipIds.employeeA)).toMatchObject({decision:{status:'break_started'}});
  command={...command,nfcTagId:pause.nfcTagId as typeof ids.tagAssignedA,expectedAssignmentId:pause.activeAssignmentId as typeof ids.assignmentA};
 }
 expect(await setup.removeTag(command)).toMatchObject({status:'succeeded'});
 expect((await pool.query('SELECT status FROM taptime_server.time_entries')).rows).toEqual([{status:'started'}]);
 // Online triggers still honor the engine's five-second duplicate window.
 await pool.query('SELECT pg_sleep(5.1)');
 if(type==='break'){
  expect((await pool.query('SELECT status FROM taptime_server.break_intervals')).rows).toEqual([{status:'started'}]);
  expect(await manual.ingestManualBreak({accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA,workEvent:{id:WorkEventId(randomUUID()),subject:{type:'break'}},receipt:{id:randomUUID(),attemptNumber:1}})).toMatchObject({decision:{status:'break_stopped'}});
 }
 expect(await manual.ingestManual({accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA,workEvent:{id:WorkEventId(randomUUID()),target:customerAssignmentTarget(CustomerId(ids.customerA))},receipt:{id:randomUUID(),attemptNumber:1}})).toMatchObject({decision:{status:'time_entry_stopped'}});
 expect((await pool.query('SELECT status FROM taptime_server.time_entries')).rows).toEqual([{status:'stopped'}]);
});

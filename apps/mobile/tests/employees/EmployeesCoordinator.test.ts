import { describe,it,expect,vi } from 'vitest';
import { EmployeesCoordinator } from '../../src/employees/EmployeesCoordinator';
import { TapTimeEmployeesApiClient } from '../../src/employees/TapTimeEmployeesApiClient';
import { AuthenticatedHttpRequestExecutor } from '../../src/transport/AuthenticatedHttpRequestExecutor';
import type { InternalAuthenticatedSessionSnapshot, MobileManagementScope } from '../../src/auth/contracts';
import type { EmployeesApiPort, ReadResult } from '../../src/employees/contracts';
import type { ManagedActiveSummary } from '@taptime/administration-contract/managed-people';
const id='12000000-0000-4000-8000-000000000001', location='51000000-0000-4000-8000-000000000001';
const person={membershipId:id,displayName:'Anna',role:'employee' as const,location:{id:location,name:'Nord'},isRunning:true,runningSince:'2026-09-18T08:00:00.000Z',runningTargetDisplayName:'Projekt'};
const summary={serverTime:'2026-09-18T12:00:00.000Z',runningCount:1,totalCount:2,people:[person],nextCursor:null};
function fixture(scope:MobileManagementScope={kind:'organization'}) {
  let snapshot:InternalAuthenticatedSessionSnapshot|null={generation:1,session:{userId:id,membershipId:id,organizationId:id,role:'administrator',nfcSetupAvailable:true,managementScope:scope,locationsEnabled:true}};
  let notify=()=>{};
  const api:EmployeesApiPort={summary:vi.fn<EmployeesApiPort['summary']>(async()=>({status:'ready',value:summary})),
    personTime:vi.fn<EmployeesApiPort['personTime']>(async request=>({status:'ready',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:request.fromInclusive,windowEndedAt:request.toExclusive}})),
    locations:vi.fn<EmployeesApiPort['locations']>(async()=>({status:'ready',value:{locations:[{id:location,name:'Nord'}],nextCursor:null}})),invite:vi.fn<EmployeesApiPort['invite']>(async()=>({status:'succeeded'}))};
  const coordinator=new EmployeesCoordinator({capture:()=>snapshot,isCurrent:s=>snapshot===s,subscribe:listener=>{notify=listener;return()=>{};}},api,()=>id,()=>Date.parse('2026-09-18T12:00:00.000Z'));
  coordinator.start();
  return {coordinator,api,revoke:()=>{snapshot=null;notify();}};
}
describe('T059 volatile Employees coordinator',()=>{
  it('discards late person data and invitation locations after session revocation',async()=>{
    const {coordinator,api,revoke}=fixture(); await coordinator.refresh();
    let resolve!:(value:Awaited<ReturnType<EmployeesApiPort['personTime']>>)=>void;
    vi.mocked(api.personTime).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const flight=coordinator.openPerson(person); revoke();
    resolve({status:'ready',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-08-31T22:00:00.000Z',windowEndedAt:'2026-09-18T12:00:00.000Z'}});
    await flight; expect(coordinator.getState()).toEqual({status:'not_authorized'});
  });
  it('keeps an uncertain invitation command for retries and pins the manager location',async()=>{
    const {coordinator,api}=fixture({kind:'location',locationId:location,locationName:'Nord'});
    await coordinator.refresh();await coordinator.openInvitation();
    vi.mocked(api.invite).mockResolvedValueOnce({status:'transient_failure'});
    await coordinator.invite(' Anna ','anna@example.test','51000000-0000-4000-8000-000000000999');
    expect(coordinator.getState()).toMatchObject({status:'invite',outcome:'transient_failure'});
    await coordinator.invite(' Anna ','anna@example.test',null);
    expect(vi.mocked(api.invite).mock.calls[0]).toEqual(vi.mocked(api.invite).mock.calls[1]);
    expect(vi.mocked(api.invite).mock.calls[0]![0]).toMatchObject({locationId:location,displayName:'Anna'});
    expect(api.locations).not.toHaveBeenCalled();
  });
  it('rejects a foreign location before submitting an admin invitation',async()=>{
    const {coordinator,api}=fixture();await coordinator.refresh();await coordinator.openInvitation();
    await coordinator.invite('Anna','anna@example.test','51000000-0000-4000-8000-000000000999');
    expect(api.invite).not.toHaveBeenCalled();expect(coordinator.getState()).toMatchObject({outcome:'invalid_request'});
  });
  it('stops duplicate pagination without inventing a complete list and clears data on leave',async()=>{
    const {coordinator,api}=fixture();vi.mocked(api.summary).mockResolvedValue({status:'ready',value:{...summary,nextCursor:'repeat'}});
    await coordinator.refresh();await coordinator.loadMore();
    expect(coordinator.getState()).toMatchObject({status:'list',failed:true,summary:{people:[person],nextCursor:'repeat'}});
    coordinator.leave();expect(coordinator.getState()).toEqual({status:'inactive'});
  });
  it('loads historical Berlin calendar months including the 745-hour October',async()=>{
    const {coordinator,api}=fixture();await coordinator.refresh();await coordinator.openPerson(person);
    await coordinator.loadPersonMonth('2025-10');
    expect(vi.mocked(api.personTime).mock.calls.at(-1)![0]).toMatchObject({fromInclusive:'2025-09-30T22:00:00.000Z',toExclusive:'2025-10-31T23:00:00.000Z'});
    const count=vi.mocked(api.personTime).mock.calls.length;
    await coordinator.loadPersonMonth('2027-01');expect(api.personTime).toHaveBeenCalledTimes(count);
  });
  it('discards a late filtered page when the user switches filters',async()=>{
    const {coordinator,api}=fixture();let resolve!:(v:ReadResult<ManagedActiveSummary>)=>void;
    vi.mocked(api.summary).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const first=coordinator.refresh();await coordinator.filter(false);
    resolve({status:'ready',value:summary});await first;
    expect(coordinator.getState()).toMatchObject({status:'list',filter:false});
  });
});
it('g: real authenticated transport preserves named T047 429/503 errors',async()=>{
  for(const [status,code] of [[429,'rate_limited'],[429,'invitation_rate_limited'],[503,'account_creation_not_configured'],[503,'invitation_delivery_failed'],[503,'invitation_needs_attention']] as const) {
    const transport=new AuthenticatedHttpRequestExecutor({async executeAuthenticatedRequest(attempt){return attempt(()=> 'synthetic-token');}},async()=>Response.json({error:{code}},{status}),undefined,true);
    const client=new TapTimeEmployeesApiClient('https://example.test',transport);
    expect(await client.invite({expectedMembershipId:id,commandId:id,displayName:'Anna',email:'anna@example.test',locationId:location})).toEqual({status:code});
  }
});

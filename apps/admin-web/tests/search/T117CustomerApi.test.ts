import { expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../../src/AdminWebApiClient';
const membership='10000000-0000-4000-8000-000000000001';
it('uses the paged customer endpoint and leaves subsequent pages to the user',async()=>{
  const value={version:'customer-hours.v3',scope:'self',asOf:'2026-10-14T08:00:00.000Z',customers:[{customerId:membership,displayName:'Müller',active:true,workDurationSeconds:0,running:false}],nextCursor:'q1:next'};
  const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}}));
  const api=new AdminWebApiClient(fetcher);
  expect(typeof api.querySearch).toBe('function');
  await expect(api.querySearch('token','customer_hours',{expectedMembershipId:membership,fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z',search:'Müller',cursor:null,limit:50})).resolves.toEqual({status:'succeeded',value});
  expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0]?.[0]).toBe('/v2/customers/hours/query');
});

it.each([
  ['cards','/v3/administration/setup-projection',{status:'succeeded',organization:{id:membership,name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null}],
  ['memberships','/v4/administration/employee-memberships-projection',{status:'succeeded',organization:{id:membership,name:'Betrieb'},employeeMemberships:[],nextCursor:null}],
  ['projects','/v2/administration/projects/query',{projects:[],nextCursor:null}],
  ['targets','/v2/mobile/work-targets/query',{targets:[],nextCursor:null}],
] as const)('uses the new default %s path',async(kind,path,value)=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}}));
 const api=new AdminWebApiClient(fetcher);
 if(kind==='cards')await api.querySearch('token','setup_tags',{expectedMembershipId:membership,kind:'nfc_tags',search:null,cursor:null,limit:50});
 if(kind==='memberships')await api.employeeProjection('token',membership,null,null);
 if(kind==='projects')await api.projects('token',membership,null);
 if(kind==='targets')await api.workTargets('token',{expectedMembershipId:membership,cursor:null,limit:50});
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0]?.[0]).toBe(path);
 expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({search:null});
});

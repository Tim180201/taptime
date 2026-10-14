import { expect, it, vi } from 'vitest';
import { TapTimeMobileWorkApiClient } from '../../src/work/TapTimeMobileWorkApiClient';
const membership='10000000-0000-4000-8000-000000000001';
const window={fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z'};
it('requests a bounded customer page on the new path without following its cursor',async()=>{
  const value={version:'customer-hours.v3',scope:'self',asOf:'2026-10-14T08:00:00.000Z',customers:[{customerId:membership,displayName:'Müller',active:true,workDurationSeconds:0,running:false}],nextCursor:'q1:next'};
  const post=vi.fn<import('../../src/transport/AuthenticatedHttpRequestExecutor').AuthenticatedJsonPostPort['post']>(async()=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify(value)}));
  const api=new TapTimeMobileWorkApiClient(new URL('https://example.invalid'),{post},()=>membership);
  expect(typeof api.querySearch).toBe('function');
  await expect(api.querySearch('customer_hours',{expectedMembershipId:membership,...window,search:'Müller',cursor:null,limit:50})).resolves.toEqual({status:'ready',value});
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0]?.[0].pathname).toBe('/v2/customers/hours/query');
});

import {expect,it,vi} from 'vitest';
import {TapTimeMobileWorkApiClient} from '../../src/work/TapTimeMobileWorkApiClient';
import {AdminWebApiClient} from '../../../admin-web/src/AdminWebApiClient';
const id='10000000-0000-4000-8000-000000000001';
const request={expectedMembershipId:id,fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z',cursor:null,limit:50};
const value={version:'customer-quota-alerts.v1',scope:'people',asOf:'2026-10-14T08:00:00.000Z',customers:[{customerId:id,displayName:'Müller',active:true,workDurationSeconds:3600,running:false,quotaSeconds:3600,quotaStage:'exceeded'}],nextCursor:'next'};
it.each(['app','web'])('%s: quota reader uses the bounded new route and rejects non-alerts and private self data',async mode=>{
 let body:any=value;
 const post=vi.fn(async(_url:URL,_body:string)=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify(body)}));
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}));
 const api=mode==='app'?new TapTimeMobileWorkApiClient(new URL('https://example.invalid'),{post},()=>id):new AdminWebApiClient(fetcher);
 const read=()=>mode==='app'?(api as TapTimeMobileWorkApiClient).readQuotaAlerts?.(request):(api as AdminWebApiClient).quotaAlerts?.('token',request);
 expect(await read()).toEqual({status:mode==='app'?'ready':'succeeded',value});
 expect(mode==='app'?post.mock.calls[0]?.[0]?.pathname:fetcher.mock.calls[0]?.[0]).toBe('/v2/customers/quota-alerts/query');
 for(const invalid of [{...value,scope:'self'},{...value,customers:value.customers.map(c=>({...c,workDurationSeconds:0,quotaStage:'ok'}))},
  {...value,customers:[],nextCursor:'next'},{...value,extra:true}]){body=invalid;expect((await read())?.status).not.toBe(mode==='app'?'ready':'succeeded');}
});
it('web: assignment reads are exact and bound to their selector; change replies preserve business errors',async()=>{
 let body:any={items:[{assignmentId:id,membershipId:id,displayName:'Anna'}],nextCursor:null},status=200;
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));
 const api=new AdminWebApiClient(fetcher),query={expectedMembershipId:id,cursor:null,limit:50,search:null,targetType:'customer' as const,targetId:id};
 expect(await api.targetAssignments?.('token',query)).toEqual({status:'succeeded',value:body});
 expect(fetcher.mock.calls[0]?.[0]).toBe('/v1/administration/target-assignments/query');
 expect((await api.targetAssignments?.('token',{expectedMembershipId:id,cursor:null,limit:50,search:null,membershipId:id}))?.status).toBe('invalid_response');
 const command={expectedMembershipId:id,commandId:id,membershipId:id,targetType:'customer' as const,targetId:id,assigned:true};
 for(const [http,result] of [[200,'succeeded'],[409,'target_not_selectable'],[409,'command_id_conflict'],[403,'forbidden']] as const){
  status=http;body={status:result};expect(await api.changeTargetAssignment?.('token',command)).toEqual({status:'succeeded',value:body});
 }
 status=403;body={error:{code:'forbidden'}};expect(await api.targetAssignments?.('token',query)).toEqual({status:'conflict',code:'forbidden'});
});
it('app: confirms a created customer through the separate v3 name search, including its cursor',async()=>{
 const {TapTimeAdministrationApiClient}=await import('../../src/administration/TapTimeAdministrationApiClient');
 const value={status:'succeeded',organization:{id,name:'Betrieb'},customers:[{id,displayName:'Müller',active:true}],nfcTags:[],nextCursor:'q1:more'};
 const post=vi.fn(async(_url:URL,_body:string)=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify(value)}));
 const api=new TapTimeAdministrationApiClient('https://example.invalid',{post});
 expect(await api.readCustomerCreationProjection(id,null,'Müller')).toMatchObject(value);
 expect(post.mock.calls[0]?.[0].pathname).toBe('/v3/administration/setup-projection');
 expect(JSON.parse(post.mock.calls[0]![1])).toEqual({expectedMembershipId:id,kind:'customers',search:'Müller',cursor:null,limit:50});
 await api.readCustomerCreationProjection(id,'q1:more','Müller');expect(JSON.parse(post.mock.calls[1]![1])).toMatchObject({search:'Müller',cursor:'q1:more'});
});

import {businessDay} from '@taptime/core';
import type {ClientSearchCapability} from '../../src/search/search';
// Existing behavior tests supply month data; expose separate search-list and detail replies.
export function customerSearch(read:(month:string)=>Promise<any>):NonNullable<ClientSearchCapability['querySearch']> {
  return (async(kind:string,request:any)=>{
    const result=await read(businessDay(Date.parse(request.fromInclusive)).slice(0,7));
    if(result.status!=='ready')return result;
    const value=result.value;
    const summary=({people:_people,days:_days,...customer}:any)=>value.scope==='people'?{quotaSeconds:null,quotaStage:'none',...customer}:customer;
    if(kind==='customer_hours')return {status:'ready',value:{version:'customer-hours.v3',scope:value.scope,asOf:value.asOf,customers:value.customers.map(summary),nextCursor:null}};
    const customer=value.customers.find((item:any)=>item.customerId===request.customerId);
    return customer?{status:'ready',value:{version:'customer-hours.detail.v1',scope:value.scope,asOf:value.asOf,customer:summary(customer),[value.scope==='people'?'people':'days']:customer.people??customer.days,nextCursor:null}}:{status:'unavailable'};
  }) as NonNullable<ClientSearchCapability['querySearch']>;
}
export function setupSearch(get:()=>any):NonNullable<ClientSearchCapability['querySearch']> {
  return (async(kind:string)=>{
    const projection=get().projection;
    return projection?{status:'ready',value:{status:'succeeded',organization:projection.organization,customers:kind==='setup_customers'?projection.customers:[],nfcTags:kind==='setup_tags'?projection.nfcTags.map((tag:any)=>({...tag,customerDisplayName:projection.customers.find((c:any)=>c.id===tag.targetCustomerId)?.displayName??null})):[],nextCursor:projection.nextCursor}}:{status:'unavailable'};
  }) as NonNullable<ClientSearchCapability['querySearch']>;
}

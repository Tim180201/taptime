import { dayStart, shiftMonth } from '@taptime/core';
import type { CustomerDay, CustomerPerson, CustomerHoursDetailResponse, CustomerHoursPageResponse, CustomerHoursQuotaSummary, CustomerHoursSummary } from '@taptime/mobile-work-contract';
import type { ClientSearchCapability } from './search';
import { useSearchPages } from './useSearchPages';

export function useCustomerSearch(capability:ClientSearchCapability,month:string,selected:string|null,authority:unknown,refresh:number) {
  const window={fromInclusive:new Date(dayStart(`${month}-01`)).toISOString(),toExclusive:new Date(dayStart(`${shiftMonth(month,1)}-01`)).toISOString()};
  const list=useSearchPages<CustomerHoursPageResponse,CustomerHoursSummary|CustomerHoursQuotaSummary>((search,cursor)=>capability.querySearch?.('customer_hours',{...window,search,cursor})??Promise.resolve({status:'unavailable'}),
    value=>value.customers,c=>c.customerId,[capability,month,authority,refresh],selected===null);
  const detail=useSearchPages<CustomerHoursDetailResponse,CustomerPerson|CustomerDay>((_search,cursor)=>capability.querySearch?.('customer_detail',{...window,customerId:selected!,cursor})??Promise.resolve({status:'unavailable'}),
    value=>value.scope==='people'?value.people:value.days,p=>'membershipId' in p?p.membershipId:p.date,[capability,month,selected,authority,refresh],selected!==null);
  const value=selected===null?list.state.value:detail.state.value;
  const d=detail.state.value;
  const customer=selected===null||!d?null:d.scope==='people'?{...d.customer,people:detail.state.items as readonly CustomerPerson[]}:{...d.customer,days:detail.state.items as readonly CustomerDay[]};
  return {list,detail,value,customer,active:selected===null?list:detail};
}

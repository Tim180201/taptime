import {dayStart,shiftMonth} from '@taptime/core';
import type {CustomerDay,CustomerPersonDaysResponse} from '@taptime/mobile-work-contract';
import type {ClientSearchCapability} from './search';
import {useSearchPages} from './useSearchPages';

export function useCustomerPersonDays(capability:ClientSearchCapability,month:string,customerId:string,targetMembershipId:string,authority:unknown,refresh:number) {
  return useSearchPages<CustomerPersonDaysResponse,CustomerDay>((_search,cursor)=>capability.querySearch?.('customer_person_days',{
    customerId,targetMembershipId,cursor,fromInclusive:new Date(dayStart(`${month}-01`)).toISOString(),
    toExclusive:new Date(dayStart(`${shiftMonth(month,1)}-01`)).toISOString(),
  })??Promise.resolve({status:'unavailable'}),value=>value.days,day=>day.date,[capability,month,customerId,targetMembershipId,authority,refresh]);
}

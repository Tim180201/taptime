import {expect,it} from 'vitest';
import {parseSearchRequest} from '../src/search.js';
import {createSearchContext} from '../src/serverSearch.js';
const id='13800000-0000-4000-8000-000000000001';
const request={expectedMembershipId:id,customerId:id,targetMembershipId:id,fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z',cursor:null,limit:50};
it('T138: the additive person-days request is closed and validated',()=>{
  expect(parseSearchRequest('customer_person_days',request)).toEqual(request);
  for(const patch of [{targetMembershipId:'bad'},{customerId:'bad'},{search:null},{limit:51},{toExclusive:'2026-11-30T23:00:00.000Z'},
    {fromInclusive:'2026-10-01T00:00:00.000Z'}, {fromInclusive:'2026-09-30T22:00:00.001Z'}])
    expect(parseSearchRequest('customer_person_days',{...request,...patch})).toBeNull();
  expect(parseSearchRequest('customer_person_days',{...request,fromInclusive:'2027-02-28T23:00:00.000Z',toExclusive:'2027-03-31T22:00:00.000Z'})).not.toBeNull();
});
it('T138: a day cursor is bound to person, customer, month and actor',()=>{
  const context=createSearchContext('customer_person_days',request);
  expect(context).not.toBeNull();
  const cursor=context!.cursor({name:'2026-10-02',id});
  expect(createSearchContext('customer_person_days',{...request,cursor})).not.toBeNull();
  for(const field of ['customerId','targetMembershipId','expectedMembershipId'])
    expect(createSearchContext('customer_person_days',{...request,cursor,[field]:'13800000-0000-4000-8000-000000000002'})).toBeNull();
});

// @vitest-environment jsdom
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { PeopleTable } from '../src/views/PeopleShared';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import { MANAGED_PEOPLE_ACCEPT_V4 } from '@taptime/administration-contract/managed-people';
import type { ManagedPerson } from '@taptime/administration-contract/managed-people';
afterEach(cleanup);
const id='12000000-0000-4000-8000-000000000001';
const person:ManagedPerson={membershipId:id,displayName:'Anna',role:'employee',location:{id,name:'Nord'},isRunning:false,runningSince:null,runningTargetDisplayName:null};
it('groups loaded pages once per location, keeps departed separate and shows customer-format hours',()=>{
 const a={...person,departedAt:null,monthWorkDurationSeconds:9000};
 const {rerender}=render(<PeopleTable people={[a]} navigate={vi.fn()} locationId={null} locationsEnabled/>);
 rerender(<PeopleTable people={[a,{...a,membershipId:'two',displayName:'Berta'},{...a,membershipId:'three',displayName:'Cem',location:{id:'south',name:'Süd'}},{...a,membershipId:'four',displayName:'Dora',departedAt:'2026-10-01T00:00:00.000Z'}]} navigate={vi.fn()} locationId={null} locationsEnabled/>);
 expect(screen.getAllByRole('heading',{name:'Nord'})).toHaveLength(2); // once current, once departed
 expect(screen.getAllByRole('heading',{name:'Süd'})).toHaveLength(1);
 expect(screen.getByRole('heading',{name:'Ausgeschieden'})).toBeDefined();
 expect(screen.getAllByText('2,5 h')).toHaveLength(4);
 expect(screen.getAllByRole('columnheader',{name:'Diesen Monat'})).toHaveLength(3);
});
it('keeps two equal-named location identities separate without repeating their headings across loaded pages',()=>{
 const a={...person,departedAt:null,monthWorkDurationSeconds:0};
 render(<PeopleTable people={[a,{...a,membershipId:'other',location:{id:'other-location',name:'Nord'}},{...a,membershipId:'later'}]} navigate={vi.fn()} locationId={null} locationsEnabled/>);
 expect(screen.getAllByRole('heading',{name:'Nord'})).toHaveLength(2);
});
it('falls back to the legacy list without v3, and skips location headings when disabled',()=>{
 const {rerender}=render(<PeopleTable people={[person]} navigate={vi.fn()} locationId={null} locationsEnabled/>);
 expect(screen.queryByText('Diesen Monat')).toBeNull();expect(screen.queryByRole('heading',{name:'Nord'})).toBeNull();
 rerender(<PeopleTable people={[{...person,monthWorkDurationSeconds:0,departedAt:null}]} navigate={vi.fn()} locationId={null}/>);
 expect(screen.getByText('0,0 h')).toBeDefined();expect(screen.queryByRole('heading',{name:'Nord'})).toBeNull();
});
it.each([1,2,3,4])('requests v4 and still reads response v%s',async version=>{
 const row=version===1?person:version===2?{...person,departedAt:null}:{...person,departedAt:null,monthWorkDurationSeconds:10};
 const fetcher=vi.fn(async(_path:RequestInfo|URL,_init?:RequestInit)=>Response.json({...(version===4?{packageUsage:{packageSize:1,activeAccessCount:1}}:{}),serverTime:'2026-10-05T08:00:00.000Z',runningCount:0,totalCount:1,people:[row],nextCursor:null}));
 expect((await new AdminWebApiClient(fetcher).managedActiveSummary('token',{expectedMembershipId:id,locationId:null,isRunning:null,cursor:null,limit:20})).status).toBe('succeeded');
 expect(fetcher.mock.calls[0]?.[1]).toMatchObject({headers:expect.objectContaining({Accept:MANAGED_PEOPLE_ACCEPT_V4})});
});

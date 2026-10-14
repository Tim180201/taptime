import { afterEach, expect, it, vi } from 'vitest';
import { SearchPager, normalizeSearch, parseSearchResponse } from '../../src/search/search';

afterEach(() => vi.useRealTimers());
const id = '10000000-0000-4000-8000-000000000001';
const summary = {customerId:id,displayName:'Müller',active:true,workDurationSeconds:7200,running:false,quotaSeconds:36000,quotaStage:'ok'};

it('normalizes a search without changing its umlauts and treats an empty field as no search', () => {
  expect(normalizeSearch('  Mu\u0308ller  Sohn  ')).toBe('Müller  Sohn');
  expect(normalizeSearch(' \n ')).toBe(null);
});

it('loads one page, debounces search, discards older replies, appends only on demand and retries a failed page', async () => {
  vi.useFakeTimers();
  let old!: (result: unknown) => void;
  const read = vi.fn().mockResolvedValueOnce({status:'ready',value:{items:['initial'],nextCursor:'page-2'}})
    .mockImplementationOnce(() => new Promise(resolve => {old=resolve;}))
    .mockResolvedValueOnce({status:'ready',value:{items:['new'],nextCursor:'next'}})
    .mockResolvedValueOnce({status:'unavailable'})
    .mockResolvedValueOnce({status:'ready',value:{items:['last'],nextCursor:null}});
  const pager = new SearchPager(read, (page: {items: string[]; nextCursor: string|null}) => page.items, item => item);
  await pager.refresh();
  expect(read).toHaveBeenCalledTimes(1);
  pager.search('  Alt  ');
  await vi.advanceTimersByTimeAsync(299);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(read).toHaveBeenLastCalledWith('Alt',null);
  pager.search('Neu');
  await vi.advanceTimersByTimeAsync(300);
  old({status:'ready',value:{items:['obsolete'],nextCursor:null}});
  await Promise.resolve();
  expect(pager.getState().items).toEqual(['new']);
  await pager.loadMore();
  expect(pager.getState()).toMatchObject({items:['new'],failed:true,nextCursor:'next'});
  await pager.retry();
  expect(pager.getState()).toMatchObject({items:['new','last'],failed:false,nextCursor:null});
  expect(read).toHaveBeenLastCalledWith('Neu','next');
  pager.dispose();
});

it('keeps an empty result distinct from a failure and invalidates in-flight results on disposal', async () => {
  let finish!: (result: unknown) => void;
  const read=vi.fn().mockResolvedValueOnce({status:'ready',value:{items:[],nextCursor:null}})
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const pager=new SearchPager(read,(page:{items:string[];nextCursor:string|null})=>page.items,item=>item);
  await pager.refresh();
  expect(pager.getState()).toMatchObject({status:'ready',items:[],failed:false});
  const pending=pager.refresh();pager.dispose();finish({status:'ready',value:{items:['old account'],nextCursor:null}});await pending;
  expect(pager.getState().items).toEqual([]);
});

it('parses bounded customer summaries and partial person details without inventing a full breakdown', () => {
  const page={version:'customer-hours.v3',scope:'people',asOf:'2026-10-14T08:00:00.000Z',customers:[summary],nextCursor:'q1:next'};
  expect(parseSearchResponse('customer_hours',page)).toEqual(page);
  const detail={version:'customer-hours.detail.v1',scope:'people',asOf:page.asOf,customer:summary,
    people:[{membershipId:id,displayName:'Person A',workDurationSeconds:3600,running:false}],nextCursor:'q1:next'};
  expect(parseSearchResponse('customer_detail',detail)).toEqual(detail);
  expect(parseSearchResponse('customer_detail',{...detail,scope:'self'})).toBeNull();
  expect(parseSearchResponse('customer_hours',{...page,customers:[{...summary,workDurationSeconds:-1}]})).toBeNull();
  expect(parseSearchResponse('customer_hours',{...page,customers:[summary,summary]})).toBeNull();
});

it('accepts new cursors for work targets and rejects unknown fields and empty nonterminal pages', () => {
  const page={targets:[{targetType:'general_work',targetId:id,displayName:'Allgemeine Arbeitszeit'}],nextCursor:'q1:opaque'};
  expect(parseSearchResponse('work_targets',page)).toEqual(page);
  expect(parseSearchResponse('work_targets',{...page,extra:true})).toBeNull();
  expect(parseSearchResponse('work_targets',{...page,targets:[]})).toBeNull();
});

it('parses project row versions and keeps each search response closed',()=>{
  const project={projectId:id,displayName:'Projekt',active:true,rowVersion:1};
  expect(parseSearchResponse('projects',{projects:[project],nextCursor:'next'})).toEqual({projects:[project],nextCursor:'next'});
  expect(parseSearchResponse('projects',{projects:[{...project,rowVersion:0}],nextCursor:null})).toBeNull();
  const organization={id,name:'Betrieb'},customer={id,displayName:'Kunde',active:true};
  const tag={id,displayName:'Eingang',validationFingerprint:'AABBCCDDEEFF',assignmentState:'assigned',assignmentType:'work',targetCustomerId:id,activeAssignmentId:id,customerDisplayName:'Kunde'};
  for(const [kind,value] of [
    ['setup_customers',{status:'succeeded',organization,customers:[customer],nfcTags:[],nextCursor:'next'}],
    ['setup_tags',{status:'succeeded',organization,customers:[],nfcTags:[tag],nextCursor:'next'}],
    ['memberships',{status:'succeeded',organization,employeeMemberships:[{id,displayName:'Müller',role:'employee',active:true,rowVersion:1,location:null}],nextCursor:'next'}],
  ] as const){
    expect(parseSearchResponse(kind,value)).toEqual(value);
    expect(parseSearchResponse(kind,{...value,extra:'private'})).toBeNull();
  }
});
it('does not combine different customer scopes or identities across pages',async()=>{
  const read=vi.fn().mockResolvedValueOnce({status:'ready',value:{scope:'people',customer:{customerId:id},items:['Person A'],nextCursor:'next'}})
    .mockResolvedValueOnce({status:'ready',value:{scope:'self',customer:{customerId:id},items:['Tag'],nextCursor:null}});
  const pager=new SearchPager(read,(page:{scope:string;customer:{customerId:string};items:string[];nextCursor:string|null})=>page.items,item=>item);
  await pager.refresh();await pager.loadMore();expect(pager.getState()).toMatchObject({items:[],value:null,failed:true});
});

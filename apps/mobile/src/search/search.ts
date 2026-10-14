import { normalizeTapTimeNameV1 } from '@taptime/administration-contract/names';
import { parseAdministrationSetupProjectionV2 } from '@taptime/administration-contract/setup-projection';
import { isCanonicalUuid, isSearchCursor, isManagedActiveSummaryV6, validateWorkTargetResponse,
  type SearchKind, type SearchResponses, type SearchRequests } from '@taptime/mobile-work-contract';

export type ClientSearchRequest<K extends SearchKind> = Omit<SearchRequests[K],'expectedMembershipId'|'limit'>;
export interface ClientSearchCapability<K extends SearchKind=SearchKind> {
  querySearch?<T extends K>(kind:T,request:ClientSearchRequest<T>):Promise<PageResult<SearchResponses[T]>>;
}

// Client-only code, also used by the web client. Never import the server search entry point.
export const searchPaths: Record<SearchKind, string> = {
  customer_hours:'/v2/customers/hours/query', customer_detail:'/v2/customers/hours/detail',
  managed_people:'/v1/administration/managed-active-summary', memberships:'/v3/administration/employee-memberships-projection',
  setup_customers:'/v3/administration/setup-projection', setup_tags:'/v3/administration/setup-projection',
  work_targets:'/v2/mobile/work-targets/query', backfill_targets:'/v2/administration/time-records/backfill-targets/query',
  projects:'/v2/administration/projects/query',
};
export function normalizeSearch(value: string): string | null {
  const trimmed=value.normalize('NFC').trim();
  if(!trimmed) return null;
  const result=normalizeTapTimeNameV1(value,'tag');
  return result.status==='valid'?result.canonicalName:trimmed;
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const name=(v:unknown):v is string=>{if(typeof v!=='string')return false;const parsed=normalizeTapTimeNameV1(v,'customer');return parsed.status==='valid'&&parsed.canonicalName===v;};
const seconds=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const duration=(v:Record<string,unknown>)=>seconds(v.workDurationSeconds)&&typeof v.running==='boolean';
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
function customer(v:unknown,people:boolean):boolean {
  if(!object(v)||!keys(v,['customerId','displayName','active','workDurationSeconds','running',...(people?['quotaSeconds','quotaStage']:[])])
    ||!isCanonicalUuid(v.customerId)||!name(v.displayName)||typeof v.active!=='boolean'||!duration(v))return false;
  if(!people)return true;
  if(v.quotaSeconds===null)return v.quotaStage==='none';
  return seconds(v.quotaSeconds)&&v.quotaSeconds>=1800&&v.quotaSeconds<=2678400&&v.quotaSeconds%1800===0
    &&v.quotaStage===(Number(v.workDurationSeconds)>=v.quotaSeconds?'exceeded':Number(v.workDurationSeconds)*10>=v.quotaSeconds*9?'warning':'ok');
}
function rows(value:unknown,cursor:unknown,identity:(row:any)=>string):value is Record<string,unknown>[] {
  return Array.isArray(value)&&value.length<=50&&(cursor===null||value.length>0)
    &&value.every(object)&&new Set(value.map(identity)).size===value.length;
}
export function parseSearchResponse<K extends SearchKind>(kind:K,value:unknown,request?:SearchRequests[K]):SearchResponses[K]|null {
  if(!object(value)||!isSearchCursor(value.nextCursor))return null;
  let valid=false;
  if(kind==='managed_people')valid=isManagedActiveSummaryV6(value)&&(value.nextCursor===null||value.people.length>0);
  else if(kind==='work_targets'||kind==='backfill_targets')valid=keys(value,['targets','nextCursor'])
    &&rows(value.targets,value.nextCursor,t=>`${t.targetType}:${t.targetId}`)&&validateWorkTargetResponse({...value,nextCursor:null});
  else if(kind==='customer_hours'||kind==='customer_detail') {
    const people=value.scope==='people', detail=kind==='customer_detail';
    if(!['self','people'].includes(String(value.scope))||!date(value.asOf))return null;
    if(!detail) valid=value.version==='customer-hours.v3'&&keys(value,['version','scope','asOf','customers','nextCursor'])
      &&rows(value.customers,value.nextCursor,c=>c.customerId)&&value.customers.every(c=>customer(c,people));
    else {
      const parts=people?'people':'days';
      valid=value.version==='customer-hours.detail.v1'&&keys(value,['version','scope','asOf','customer',parts,'nextCursor'])
        &&customer(value.customer,people)&&rows(value[parts],value.nextCursor,p=>people?p.membershipId:p.date)
        &&(value[parts] as Record<string,unknown>[]).every(p=>duration(p)&&(people
          ?keys(p,['membershipId','displayName','workDurationSeconds','running'])&&isCanonicalUuid(p.membershipId)&&name(p.displayName)
          :keys(p,['date','workDurationSeconds','running'])&&typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)));
    }
  } else if(kind==='setup_customers'||kind==='setup_tags') {
    if(!keys(value,['status','organization','customers','nfcTags','nextCursor'])||!Array.isArray(value.nfcTags)||!Array.isArray(value.customers))return null;
    const tags=value.nfcTags;
    if(!tags.every(t=>object(t)&&Object.hasOwn(t,'customerDisplayName')&&(t.assignmentType==='work'?name(t.customerDisplayName):t.customerDisplayName===null)))return null;
    const parsed=parseAdministrationSetupProjectionV2({...value,nextCursor:null,nfcTags:tags.map(({customerDisplayName:_name,...tag})=>tag)});
    valid=parsed!==null&&parsed.customersComplete&&parsed.nfcTagsComplete
      &&(kind==='setup_tags'?value.customers.length===0&&rows(tags,value.nextCursor,t=>t.id):tags.length===0&&rows(value.customers,value.nextCursor,c=>c.id));
  } else if(kind==='memberships') {
    valid=keys(value,['status','organization','employeeMemberships','nextCursor'])&&value.status==='succeeded'
      &&object(value.organization)&&keys(value.organization,['id','name'])&&isCanonicalUuid(value.organization.id)&&name(value.organization.name)
      &&rows(value.employeeMemberships,value.nextCursor,m=>m.id)&&value.employeeMemberships.every(m=>keys(m,['id','displayName','role','active','rowVersion','location'])
        &&isCanonicalUuid(m.id)&&name(m.displayName)&&['administrator','standortleitung','employee'].includes(String(m.role))&&typeof m.active==='boolean'
        &&Number.isSafeInteger(m.rowVersion)&&Number(m.rowVersion)>=1&&(m.location===null||object(m.location)&&keys(m.location,['id','name'])&&isCanonicalUuid(m.location.id)&&name(m.location.name)));
  } else if(kind==='projects')valid=keys(value,['projects','nextCursor'])&&rows(value.projects,value.nextCursor,p=>p.projectId)
    &&value.projects.every(p=>keys(p,['projectId','displayName','active','rowVersion'])&&isCanonicalUuid(p.projectId)&&name(p.displayName)&&typeof p.active==='boolean'&&Number.isSafeInteger(p.rowVersion)&&Number(p.rowVersion)>=1);
  if(request&&kind==='customer_detail'&&object(value.customer)&&value.customer.customerId!==(request as SearchRequests['customer_detail']).customerId)return null;
  return valid?value as unknown as SearchResponses[K]:null;
}

export type PageResult<P>={status:'ready';value:P}|{status:string;value?:never};
export interface SearchState<P,T> {status:'loading'|'ready'|'unavailable';search:string|null;items:readonly T[];value:P|null;nextCursor:string|null;busy:boolean;failed:boolean}
export class SearchPager<P extends {readonly nextCursor:string|null},T> {
  private state:SearchState<P,T>={status:'loading',search:null,items:[],value:null,nextCursor:null,busy:false,failed:false};
  private listeners=new Set<()=>void>();
  private generation=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private failedCursor:string|null=null;
  private cursors=new Set<string>();
  constructor(private readonly read:(search:string|null,cursor:string|null)=>Promise<PageResult<P>>,private readonly items:(page:P)=>readonly T[],private readonly identity:(item:T)=>string){}
  getState=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  search(input:string){const search=normalizeSearch(input);if(search===this.state.search)return;clearTimeout(this.timer);this.generation++;this.cursors.clear();this.publish({status:'loading',search,items:[],value:null,nextCursor:null,busy:true,failed:false});this.timer=setTimeout(()=>void this.refresh(),300);}
  refresh=async()=>{clearTimeout(this.timer);this.cursors.clear();await this.load(null);};
  loadMore=async()=>{if(!this.state.busy&&this.state.nextCursor!==null)await this.load(this.state.nextCursor);};
  retry=async()=>{await this.load(this.failedCursor);};
  dispose(){clearTimeout(this.timer);this.generation++;}
  private publish(state:SearchState<P,T>){this.state=state;this.listeners.forEach(listener=>listener());}
  private async load(cursor:string|null){
    const generation=++this.generation,previous=this.state;this.failedCursor=cursor;
    this.publish({...previous,busy:true,failed:false,...(cursor===null?{status:'loading' as const,items:[],value:null,nextCursor:null}:{})});
    let result:PageResult<P>;try{result=await this.read(previous.search,cursor);}catch{result={status:'unavailable'};}
    if(generation!==this.generation)return;
    const value=result.status==='ready'?result.value:undefined;
    const items=value?[...(cursor===null?[]:previous.items),...this.items(value)]:[];
    const changedContext=cursor!==null&&value&&previous.value&&!sameContext(previous.value,value);
    if(!value||changedContext||(value.nextCursor!==null&&(this.cursors.has(value.nextCursor)||value.nextCursor===cursor))||new Set(items.map(this.identity)).size!==items.length){
      const rejected=result.status==='authority_rejected'||changedContext;
      this.publish({...this.state,...(rejected?{items:[],value:null,nextCursor:null}:{}),status:cursor!==null&&!rejected?'ready':'unavailable',busy:false,failed:true});return;
    }
    if(cursor!==null)this.cursors.add(cursor);
    this.publish({status:'ready',search:previous.search,items,value,nextCursor:value.nextCursor,busy:false,failed:false});
  }
}

function sameContext(previous:unknown,next:unknown):boolean {
  if(!object(previous)||!object(next))return true;
  if(previous.scope!==next.scope)return false;
  if(object(previous.customer)&&object(next.customer)&&previous.customer.customerId!==next.customer.customerId)return false;
  if(object(previous.organization)&&object(next.organization)&&previous.organization.id!==next.organization.id)return false;
  return true;
}

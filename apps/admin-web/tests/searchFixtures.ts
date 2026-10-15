import type {ClientSearchCapability} from '../../mobile/src/search/search';
export {customerSearch} from '../../mobile/tests/search/fixtures';
export function stateSearch(get:()=>any):NonNullable<ClientSearchCapability['querySearch']> {
 return (async(kind:string,request:any)=>{
  const state=get();if(state.status!=='ready')return {status:'unavailable'};
  const projection=state.projection;
  const value=kind==='setup_tags'||kind==='setup_customers'?{status:'succeeded',organization:projection.organization,customers:kind==='setup_customers'?projection.customers:[],nfcTags:kind==='setup_tags'?projection.nfcTags.map((tag:any)=>({...tag,customerDisplayName:projection.customers.find((c:any)=>c.id===tag.targetCustomerId)?.displayName??null})):[],nextCursor:null}
   :kind==='memberships'?{status:'succeeded',...state.employeeProjection,employeeMemberships:state.employeeProjection.employeeMemberships.map((m:any)=>({firstSignedInAt:null,lastSignedInAt:null,...m})).filter((m:any)=>request.active==null||m.active===request.active)}:kind==='projects'?{projects:state.projects??[],nextCursor:null}:{targets:(state.workTargets?.value??[]).map((t:any)=>({...t,[kind==='backfill_targets'?'assignedToPerson':'assignedToMe']:!!t.assignedToMe})).filter((t:any)=>!request.assignedOnly||t.assignedToMe||t.assignedToPerson),nextCursor:null};
  return {status:'ready',value};
 }) as NonNullable<ClientSearchCapability['querySearch']>;
}

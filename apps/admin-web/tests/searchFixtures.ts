import type {ClientSearchCapability} from '../../mobile/src/search/search';
export {customerSearch} from '../../mobile/tests/search/fixtures';
export function stateSearch(get:()=>any):NonNullable<ClientSearchCapability['querySearch']> {
 return (async(kind:string)=>{
  const state=get();if(state.status!=='ready')return {status:'unavailable'};
  const projection=state.projection;
  const value=kind==='setup_tags'||kind==='setup_customers'?{status:'succeeded',organization:projection.organization,customers:kind==='setup_customers'?projection.customers:[],nfcTags:kind==='setup_tags'?projection.nfcTags.map((tag:any)=>({...tag,customerDisplayName:projection.customers.find((c:any)=>c.id===tag.targetCustomerId)?.displayName??null})):[],nextCursor:null}
   :kind==='memberships'?{status:'succeeded',...state.employeeProjection}:kind==='projects'?{projects:state.projects??[],nextCursor:null}:{targets:state.workTargets?.value??[],nextCursor:null};
  return {status:'ready',value};
 }) as NonNullable<ClientSearchCapability['querySearch']>;
}

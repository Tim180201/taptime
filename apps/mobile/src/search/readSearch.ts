import { parseSearchRequest, type SearchKind, type SearchRequests, type SearchResponses } from '@taptime/mobile-work-contract';
import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import { parseSearchResponse, searchPaths, type PageResult } from './search';

export async function readSearch<K extends SearchKind>(requests:AuthenticatedJsonPostPort,base:URL,kind:K,request:SearchRequests[K]):Promise<PageResult<SearchResponses[K]>> {
  const parsed=parseSearchRequest(kind,request);
  if(!parsed)return {status:'unavailable'};
  try {
    const result=await requests.post(new URL(searchPaths[kind],base),JSON.stringify(parsed),kind==='managed_people'?{includePeopleSearch:true}:undefined);
    if(result.status==='authority_rejected'||result.status==='response'&&(result.statusCode===401||result.statusCode===403))return {status:'authority_rejected'};
    if(result.status!=='response')return result;
    if(result.statusCode!==200||result.contentType?.split(';')[0]?.trim().toLowerCase()!=='application/json')return {status:'unavailable'};
    const value=parseSearchResponse(kind,JSON.parse(result.body),parsed);
    return value?{status:'ready',value}:{status:'unavailable'};
  } catch {return {status:'unavailable'};}
}

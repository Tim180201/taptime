import type { AuthenticatedRequestCapability } from '../auth/contracts';
import type { IssueStatus } from './contracts';

/** A capability 401 is a resource outcome, never an authentication rejection. */
export async function issueCapability(
  auth:AuthenticatedRequestCapability & {refresh():Promise<void>},
  issue:(accessToken:string)=>Promise<IssueStatus>,
  isCurrent:()=>boolean,
):Promise<IssueStatus> {
  for (let attempt=0;attempt<2;attempt++) {
    if (!isCurrent()) return 'superseded';
    const result=await auth.executeAuthenticatedRequest(async token=>({status:'completed',value:await issue(token())}));
    if (!isCurrent()) return 'superseded';
    if (result.status!=='completed') return 'unavailable';
    if (result.value!=='unauthorized' || attempt===1) return result.value;
    await auth.refresh();
  }
  return 'unauthorized';
}

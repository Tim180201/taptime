import { UserId, MembershipId, OrganizationId } from '@taptime/core';
import { type Server } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createBackendHttpServer, BACKEND_HTTP_ROUTES } from '../src/BackendHttpServer.js';
import type { SessionAuthorityResolver, SessionApiDiagnostic } from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';
import { listen, closeServer } from './fixtures.js';
const session = { userId:UserId('10000000-0000-4000-8000-000000000001'), membershipId:MembershipId('20000000-0000-4000-8000-000000000001'), organizationId:OrganizationId('30000000-0000-4000-8000-000000000001'), role:'administrator' as const, nfcSetupAvailable:true, locationsEnabled:false, managementScope:{kind:'organization' as const} };
const authority: SessionAuthorityResolver = { resolve:async()=>({status:'resolved',session}) };
async function run(check:(origin:string)=>Promise<void>) {
  const server=createSessionRegressionServer(authority); await listen(server);
  try { const address=server.address(); if(!address || typeof address==='string')throw Error('address'); await check(`http://127.0.0.1:${address.port}`); }
  finally { await closeServer(server); }
}
describe('T-096 app minimum builds and representations',()=>{
  it.each([['ios',4,5],['android',11,12]])('rejects %s below its minimum on every registered app route',async(platform,below,minimum)=>run(async origin=>{
    for(const [path,route] of Object.entries(BACKEND_HTTP_ROUTES)) {
      if(route==='health' || route.startsWith('operator_'))continue;
      const response=await fetch(origin+path,{method:path.endsWith('/session')?'GET':'POST',headers:{'X-TapTime-App':`v1;${platform};${below};${'a'.repeat(40)}`}});
      expect(response.status,path).toBe(426);
      expect(await response.json()).toEqual({error:{code:'app_update_required',message:'Bitte App aktualisieren'}});
    }
    expect((await fetch(origin+'/v1/session',{headers:{Authorization:'Bearer aaa.bbb.ccc','X-TapTime-App':`v1;${platform};${minimum};${'a'.repeat(40)}`}})).status).toBe(200);
  }));
  it('keeps installed v2 bytes and exposes an explicit v3 representation',async()=>run(async origin=>{
    const headers={Authorization:'Bearer aaa.bbb.ccc'};
    const v2=await fetch(origin+'/v1/session',{headers:{...headers,Accept:'application/vnd.taptime.mobile-session.v2+json'}});
    expect(await v2.text()).toBe(JSON.stringify(session));
    const v3=await fetch(origin+'/v1/session',{headers:{...headers,Accept:'application/vnd.taptime.mobile-session.v3+json'}});
    expect(v3.headers.get('content-type')).toBe('application/vnd.taptime.mobile-session.v3+json; charset=utf-8');
    expect(await v3.json()).toEqual(session);
  }));
});
function createSessionRegressionServer(
  authority: SessionAuthorityResolver,
  options: {
    readonly onDiagnostic?: (diagnostic: SessionApiDiagnostic) => void;
    readonly authorityTimeoutMilliseconds?: number;
  } = {},
): Server {
  return createBackendHttpServer({
    ...unavailableOfflineDependencies(),
    sessionAuthority: authority,
    scanContextResolver: {
      async resolve() {
        return { status: 'not_resolved' };
      },
    },
    lifecycleIngestor: {
      async ingest() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    deferredLifecycleIngestor: {
      async ingestDeferred() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    administration: {
      async createCustomer() {
        return { status: 'unauthorized' };
      },
      async provisionNfcTag() {
        return { status: 'unauthorized' };
      },
      async readSetupProjection() {
        return { status: 'unauthorized' };
      },
    },
    employeeEnrollment: unavailableEmployeeEnrollment(),
    tagReassignment: {
      async reassignNfcTag() {
        return { status: 'unauthorized' };
      },
    },
  }, {
    onDiagnostic: options.onDiagnostic,
    operationTimeoutMilliseconds: options.authorityTimeoutMilliseconds,
  });
}

function unavailableEmployeeEnrollment() {
  return {
    async createInvitation() {
      return { status: 'unauthorized' as const };
    },
    async redeemInvitation() {
      return { status: 'unauthorized' as const };
    },
    async readEmployeeMembershipsProjection() {
      return { status: 'unauthorized' as const };
    },
    async revokeMembership() { return { status: 'unauthorized' as const }; },
    async changeMembershipRole() { return { status: 'unauthorized' as const }; },
    async recordPasswordReset() { return { status: 'unauthorized' as const }; },
  };
}

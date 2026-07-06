import type { AuthenticationGateway, Credentials } from '../../ports/AuthenticationGateway';
import type { AuthenticationResult } from '../../application/AuthenticationResult';
import { OrganizationId, UserId } from '../../domain/ids';

export interface DemoAuthenticationAccount {
  readonly signInCode: string;
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
}

// Clearly-labeled demo account, consistent with the demo Organization/Employee naming used
// elsewhere in the repository (e.g. buildScanDemoPipeline's 'demo-org'/'demo-employee').
export const DEFAULT_DEMO_ACCOUNT: DemoAuthenticationAccount = {
  signInCode: 'demo-employee-code',
  userId: UserId('demo-employee'),
  organizationId: OrganizationId('demo-org'),
};

// Fake/local implementation of DT-013's AuthenticationGateway port - mirrors
// FakeSynchronizationGateway's role as a configurable double for DT-008. Authenticates a
// small, clearly-labeled set of demo accounts against an in-memory credential set only; no
// real managed authentication provider, no password flow, no Firestore (Development Sprint
// 007 Plan, Section 7).
export class FakeAuthenticationGateway implements AuthenticationGateway {
  private readonly accountsBySignInCode: Map<string, DemoAuthenticationAccount>;

  constructor(accounts: readonly DemoAuthenticationAccount[] = [DEFAULT_DEMO_ACCOUNT]) {
    this.accountsBySignInCode = new Map(accounts.map((account) => [account.signInCode, account]));
  }

  authenticate(credentials: Credentials): AuthenticationResult {
    const account = this.accountsBySignInCode.get(credentials.signInCode);
    if (account === undefined) {
      return { status: 'rejected', reason: 'invalid_credentials' };
    }

    return { status: 'authenticated', userId: account.userId, organizationId: account.organizationId };
  }
}

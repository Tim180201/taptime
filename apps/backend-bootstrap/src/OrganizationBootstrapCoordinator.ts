import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { normalizeOrganizationNameV1 } from './nameContract.js';
import type {
  BootstrapCapability,
  BootstrapOrganizationCommand,
  BootstrapOrganizationResult,
} from './types.js';
import { InvalidBootstrapRequestError } from './types.js';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class OrganizationBootstrapCoordinator {
  constructor(
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly capability: BootstrapCapability,
  ) {}

  async bootstrap(command: BootstrapOrganizationCommand): Promise<BootstrapOrganizationResult> {
    if (
      !canonicalUuidPattern.test(command.requestId)
      || command.accessToken.length < 1
      || Buffer.byteLength(command.accessToken, 'utf8') > 131_072
    ) {
      return { status: 'rejected', reason: 'invalid_request' };
    }
    const name = normalizeOrganizationNameV1(command.organizationDisplayName);
    if (name.status === 'invalid') {
      return { status: 'rejected', reason: 'invalid_request' };
    }

    try {
      const verification = await this.accessTokenVerifier.verify(command.accessToken);
      if (verification.status === 'rejected') {
        return {
          status: 'rejected',
          reason: 'access_token_rejected',
          tokenReason: verification.reason,
        };
      }
      return await this.capability.execute({
        requestId: command.requestId,
        canonicalOrganizationName: name.canonicalName,
        identity: verification.identity,
      });
    } catch (error) {
      if (error instanceof InvalidBootstrapRequestError) {
        return { status: 'rejected', reason: 'invalid_request' };
      }
      return { status: 'unavailable', reason: 'service_unavailable' };
    }
  }
}

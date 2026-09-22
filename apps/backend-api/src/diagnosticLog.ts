import type { BackendApiDiagnostic, BackendApiDiagnosticSink } from './types.js';

export interface BackendApiDiagnosticLogOptions {
  readonly now?: () => Date;
  readonly output?: Pick<NodeJS.WritableStream, 'write'>;
}

export function createBackendApiDiagnosticLogSink(
  options: BackendApiDiagnosticLogOptions = {},
): BackendApiDiagnosticSink {
  const now = options.now ?? (() => new Date());
  const output = options.output ?? process.stderr;

  return (diagnostic) => {
    const record = {
      timestamp: now().toISOString(),
      error_class: diagnostic.code,
      ...(diagnostic.route === undefined ? {} : { route: diagnostic.route }),
      correlation_id: diagnostic.correlationId,
      ...invitationFields(diagnostic),
    };
    output.write(`${JSON.stringify(record)}\n`);
  };
}

function invitationFields(diagnostic: BackendApiDiagnostic) {
  if (diagnostic.code !== 'account_invitation_provider_request'
    && diagnostic.code !== 'account_invitation_needs_attention') return {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const target = diagnostic.targetAccount ?? '';
  return {
    ...(uuid.test(diagnostic.organizationId ?? '') ? { organization_id: diagnostic.organizationId } : {}),
    ...(uuid.test(diagnostic.administratorMembershipId ?? '')
      ? { administrator_membership_id: diagnostic.administratorMembershipId } : {}),
    ...(uuid.test(diagnostic.operatorId ?? '') ? { operator_id: diagnostic.operatorId } : {}),
    ...(uuid.test(target) || /^[0-9a-f]{64}$/.test(target) ? { target_account: target } : {}),
  };
}

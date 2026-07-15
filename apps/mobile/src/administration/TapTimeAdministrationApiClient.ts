import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import { hasExactKeys, isJsonContentType, isObject, isUuid, parseJsonObject } from '../transport/strictJson';
import type { AdminProjectionResult, AdminSetupApiPort, ProvisionAdminTagResult } from './contracts';

const fingerprintPattern = /^[A-F0-9]{12}$/;
const cursorPattern = /^v1:[ct]:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class TapTimeAdministrationApiClient implements AdminSetupApiPort {
  private readonly projectionEndpoint: URL;
  private readonly provisionEndpoint: URL;

  constructor(baseUrl: string, private readonly request: AuthenticatedJsonPostPort) {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.projectionEndpoint = new URL('v1/administration/setup-projection', base);
    this.provisionEndpoint = new URL('v1/administration/nfc-tags/provision', base);
  }

  async readProjection(expectedMembershipId: string, cursor: string | null): Promise<AdminProjectionResult> {
    if (!isUuid(expectedMembershipId) || (cursor !== null && !cursorPattern.test(cursor))) return { status: 'unavailable' };
    const response = await this.request.post(this.projectionEndpoint, JSON.stringify({
      expectedMembershipId, cursor, limit: 20,
    }));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) return { status: 'authority_rejected' };
    if (response.statusCode !== 200 || !isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const value = parseProjection(response.body);
    return value === null ? { status: 'unavailable' } : value;
  }

  async provisionTag(command: Parameters<AdminSetupApiPort['provisionTag']>[0]): Promise<ProvisionAdminTagResult> {
    if (!isUuid(command.expectedMembershipId) || !isUuid(command.commandId) || !isUuid(command.customerId)) {
      return { status: 'invalid_request' };
    }
    const response = await this.request.post(this.provisionEndpoint, JSON.stringify(command));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) return { status: 'authority_rejected' };
    if (!isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (response.statusCode === 200 && body !== null && hasExactKeys(body, ['status', 'idempotentRetry', 'nfcTag', 'assignmentId'])
      && body.status === 'succeeded' && typeof body.idempotentRetry === 'boolean' && isUuid(body.assignmentId)
      && isObject(body.nfcTag) && hasExactKeys(body.nfcTag, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'targetCustomerId'])
      && isUuid(body.nfcTag.id) && typeof body.nfcTag.displayName === 'string'
      && fingerprintPattern.test(String(body.nfcTag.validationFingerprint))
      && body.nfcTag.assignmentState === 'assigned' && isUuid(body.nfcTag.targetCustomerId)) {
      return { status: 'succeeded', validationFingerprint: String(body.nfcTag.validationFingerprint) };
    }
    const code = parseErrorCode(body);
    if (code === 'invalid_request' || code === 'assignment_target_unavailable'
      || code === 'tag_payload_already_registered' || code === 'command_id_conflict') return { status: code };
    return { status: 'unavailable' };
  }
}

function parseProjection(text: string): AdminProjectionResult | null {
  const body = parseJsonObject(text);
  if (body === null || !hasExactKeys(body, ['status', 'organization', 'customers', 'nfcTags', 'nextCursor'])
    || body.status !== 'succeeded' || !isObject(body.organization)
    || !hasExactKeys(body.organization, ['id', 'name']) || !isUuid(body.organization.id)
    || typeof body.organization.name !== 'string' || !Array.isArray(body.customers)
    || !Array.isArray(body.nfcTags) || !(body.nextCursor === null || (typeof body.nextCursor === 'string' && cursorPattern.test(body.nextCursor)))) return null;
  const customers = body.customers.map(parseCustomer);
  const nfcTags = body.nfcTags.map(parseTag);
  if (customers.some((value) => value === null) || nfcTags.some((value) => value === null)) return null;
  return Object.freeze({ status: 'succeeded' as const, organization: Object.freeze({ id: body.organization.id, name: body.organization.name }), customers: Object.freeze(customers as NonNullable<ReturnType<typeof parseCustomer>>[]), nfcTags: Object.freeze(nfcTags as NonNullable<ReturnType<typeof parseTag>>[]), nextCursor: body.nextCursor });
}

function parseCustomer(value: unknown) {
  if (!isObject(value) || !hasExactKeys(value, ['id', 'displayName', 'active']) || !isUuid(value.id)
    || typeof value.displayName !== 'string' || typeof value.active !== 'boolean') return null;
  return Object.freeze({ id: value.id, displayName: value.displayName, active: value.active });
}

function parseTag(value: unknown) {
  if (!isObject(value) || !hasExactKeys(value, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'targetCustomerId'])
    || !isUuid(value.id) || typeof value.displayName !== 'string'
    || !fingerprintPattern.test(String(value.validationFingerprint))
    || (value.assignmentState !== 'assigned' && value.assignmentState !== 'unassigned')
    || !(value.targetCustomerId === null || isUuid(value.targetCustomerId))) return null;
  return Object.freeze({ id: value.id, displayName: value.displayName, validationFingerprint: String(value.validationFingerprint), assignmentState: value.assignmentState, targetCustomerId: value.targetCustomerId });
}

function parseErrorCode(body: Record<string, unknown> | null): string | null {
  return body !== null && hasExactKeys(body, ['error']) && isObject(body.error)
    && hasExactKeys(body.error, ['code']) && typeof body.error.code === 'string' ? body.error.code : null;
}

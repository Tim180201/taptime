import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import { hasExactKeys, isJsonContentType, isObject, isUuid, parseJsonObject } from '../transport/strictJson';
import type { AdminProjectionResult, AdminSetupApiPort, ProvisionAdminTagResult, CreateAdminCustomerResult } from './contracts';

const fingerprintPattern = /^[A-F0-9]{12}$/;
const cursorPattern = /^v1:[ct]:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class TapTimeAdministrationApiClient implements AdminSetupApiPort {
  private readonly createCustomerEndpoint: URL;
  private readonly locationsEndpoint: URL;
  private readonly projectionEndpoint: URL;
  private readonly provisionEndpoint: URL;
  private readonly provisionBreakEndpoint: URL;

  constructor(baseUrl: string, private readonly request: AuthenticatedJsonPostPort) {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.createCustomerEndpoint = new URL('v1/administration/customers', base);
    this.locationsEndpoint = new URL('v1/administration/locations/query', base);
    this.projectionEndpoint = new URL('v1/administration/setup-projection', base);
    this.provisionEndpoint = new URL('v1/administration/nfc-tags/provision', base);
    this.provisionBreakEndpoint = new URL('v1/administration/nfc-tags/provision-break', base);
  }

  async readCustomerLocations(expectedMembershipId: string, cursor: string | null): ReturnType<NonNullable<AdminSetupApiPort['readCustomerLocations']>> {
    const locationCursor = /^v1:l:[0-9a-f-]{36}$/;
    if (!isUuid(expectedMembershipId) || (cursor !== null && !locationCursor.test(cursor))) return { status: 'unavailable' };
    const response = await this.request.post(this.locationsEndpoint, JSON.stringify({ expectedMembershipId, cursor, limit: 100 }));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) return { status: 'authority_rejected' };
    if (response.statusCode !== 200 || !isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (body === null || !hasExactKeys(body, ['status', 'locations', 'nextCursor']) || body.status !== 'succeeded'
      || !Array.isArray(body.locations) || body.locations.length > 100
      || !(body.nextCursor === null || (typeof body.nextCursor === 'string' && locationCursor.test(body.nextCursor)))) return { status: 'unavailable' };
    const locations: { id: string; displayName: string }[] = [];
    for (const location of body.locations) {
      if (!isObject(location) || !hasExactKeys(location, ['id', 'displayName']) || !isUuid(location.id)
        || typeof location.displayName !== 'string' || locations.some(item => item.id === location.id)) return { status: 'unavailable' };
      locations.push({ id: location.id, displayName: location.displayName });
    }
    return { status: 'succeeded', locations, nextCursor: body.nextCursor };
  }

  async createCustomer(command: Parameters<NonNullable<AdminSetupApiPort['createCustomer']>>[0]): Promise<CreateAdminCustomerResult> {
    if (!isUuid(command.expectedMembershipId) || !isUuid(command.commandId)
      || (command.locationId !== undefined && !isUuid(command.locationId))) return { status: 'invalid_request' };
    const response = await this.request.post(this.createCustomerEndpoint, JSON.stringify(command));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401) return { status: 'authority_rejected' };
    if (!isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (response.statusCode === 200 && body !== null && hasExactKeys(body, ['status', 'idempotentRetry', 'customer'])
      && body.status === 'succeeded' && typeof body.idempotentRetry === 'boolean') {
      const customer = parseCustomer(body.customer);
      if (customer !== null && customer.active) return { status: 'succeeded', customer };
    }
    const code = parseErrorCode(body);
    if ((response.statusCode === 400 && (code === 'location_required' || code === 'invalid_request'))
      || (response.statusCode === 403 && code === 'forbidden')
      || (response.statusCode === 409 && code === 'command_id_conflict')) return { status: code };
    return { status: 'unavailable' };
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
      && isObject(body.nfcTag) && hasExactKeys(body.nfcTag, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'assignmentType', 'targetCustomerId'])
      && isUuid(body.nfcTag.id) && typeof body.nfcTag.displayName === 'string'
      && fingerprintPattern.test(String(body.nfcTag.validationFingerprint))
      && body.nfcTag.assignmentState === 'assigned' && body.nfcTag.assignmentType === 'work'
      && isUuid(body.nfcTag.targetCustomerId)) {
      return { status: 'succeeded', validationFingerprint: String(body.nfcTag.validationFingerprint) };
    }
    const code = parseErrorCode(body);
    if (code === 'invalid_request' || code === 'assignment_target_unavailable'
      || code === 'tag_payload_already_registered' || code === 'command_id_conflict') return { status: code };
    return { status: 'unavailable' };
  }

  async provisionBreakTag(
    command: Parameters<NonNullable<AdminSetupApiPort['provisionBreakTag']>>[0],
  ): Promise<ProvisionAdminTagResult> {
    if (!isUuid(command.expectedMembershipId) || !isUuid(command.commandId)) {
      return { status: 'invalid_request' };
    }
    const response = await this.request.post(this.provisionBreakEndpoint, JSON.stringify(command));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) {
      return { status: 'authority_rejected' };
    }
    if (!isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (response.statusCode === 200 && body !== null
      && hasExactKeys(body, ['status', 'idempotentRetry', 'nfcTag', 'assignmentId'])
      && body.status === 'succeeded' && isUuid(body.assignmentId)
      && isObject(body.nfcTag) && hasExactKeys(body.nfcTag, ['id', 'displayName',
        'validationFingerprint', 'assignmentState', 'assignmentType', 'targetCustomerId'])
      && isUuid(body.nfcTag.id) && body.nfcTag.assignmentState === 'assigned'
      && body.nfcTag.assignmentType === 'break' && body.nfcTag.targetCustomerId === null
      && fingerprintPattern.test(String(body.nfcTag.validationFingerprint))) {
      return { status: 'succeeded',
        validationFingerprint: String(body.nfcTag.validationFingerprint) };
    }
    const code = parseErrorCode(body);
    if (code === 'invalid_request' || code === 'tag_payload_already_registered'
      || code === 'command_id_conflict') return { status: code };
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
  if (!isObject(value) || !hasExactKeys(value, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'assignmentType', 'targetCustomerId', 'activeAssignmentId'])
    || !isUuid(value.id) || typeof value.displayName !== 'string'
    || !fingerprintPattern.test(String(value.validationFingerprint))
    || (value.assignmentState !== 'assigned' && value.assignmentState !== 'unassigned')
    || (value.assignmentType !== 'work' && value.assignmentType !== 'break'
      && value.assignmentType !== null)
    || !(value.targetCustomerId === null || isUuid(value.targetCustomerId))
    || !(value.activeAssignmentId === null || isUuid(value.activeAssignmentId))
    || !(
      (value.assignmentState === 'assigned' && value.assignmentType === 'work'
        && value.targetCustomerId !== null && value.activeAssignmentId !== null)
      || (value.assignmentState === 'assigned' && value.assignmentType === 'break'
        && value.targetCustomerId === null && value.activeAssignmentId !== null)
      || (value.assignmentState === 'unassigned' && value.assignmentType === null
        && value.targetCustomerId === null && value.activeAssignmentId === null)
    )) return null;
  return Object.freeze({ id: value.id, displayName: value.displayName, validationFingerprint: String(value.validationFingerprint), assignmentState: value.assignmentState, assignmentType: value.assignmentType, targetCustomerId: value.targetCustomerId, activeAssignmentId: value.activeAssignmentId });
}

function parseErrorCode(body: Record<string, unknown> | null): string | null {
  return body !== null && hasExactKeys(body, ['error']) && isObject(body.error)
    && hasExactKeys(body.error, ['code']) && typeof body.error.code === 'string' ? body.error.code : null;
}

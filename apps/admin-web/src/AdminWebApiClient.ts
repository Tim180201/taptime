import type {
  CursorPage,
  SafeEmployeeProjection,
  SafeProjection,
  SafeProject,
  SafeReviewItem,
  SafeTimeRecord,
  VolatileInvitationSecret,
} from './contracts';
import { isSafeEmployeeProjectionPage } from './employeeProjectionSafety';

const maximumJsonBodyBytes = 16 * 1024;
const maximumTimeReviewBodyBytes = 256 * 1024;
const maximumCsvBodyBytes = 8 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cursor = /^v1:[ct]:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const employeeCursor = /^v1:e:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invitationSecret = /^[A-Za-z0-9_-]{43}$/;
const canonicalTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const opaqueCursor = /^[A-Za-z0-9_-]{1,512}$/;
const projectCursor = /^v1:[A-Za-z0-9_-]{1,252}$/;
const fingerprint = /^[A-F0-9]{12}$/;
export type Session = { readonly membershipId: string; readonly role: 'administrator' | 'employee' };
export type ApiResult<Value> =
  | { readonly status: 'succeeded'; readonly value: Value }
  | { readonly status: 'rejected' | 'unavailable' }
  | {
      readonly status: 'conflict';
      readonly code:
        | 'command_id_conflict'
        | 'assignment_conflict'
        | 'assignment_in_use'
        | 'assignment_target_unavailable'
        | 'invitation_created_token_unavailable'
        | 'invitation_limit_reached'
        | 'time_review_conflict'
        | 'not_adjustable'
        | 'invalid_evidence'
        | 'project_in_use'
        | 'project_unavailable'
        | 'stale_row_version';
    };

export interface AdminWebApiPort {
  session(token: string): Promise<ApiResult<Session>>;
  projection(token: string, membershipId: string, nextCursor: string | null): Promise<ApiResult<SafeProjection>>;
  createCustomer(
    token: string,
    membershipId: string,
    commandId: string,
    displayName: string,
  ): Promise<ApiResult<true>>;
  employeeProjection(
    token: string,
    membershipId: string,
    nextCursor: string | null,
  ): Promise<ApiResult<SafeEmployeeProjection>>;
  createEmployeeInvitation(
    token: string,
    membershipId: string,
    commandId: string,
    displayName: string,
  ): Promise<ApiResult<VolatileInvitationSecret>>;
  reassignNfcTag(
    token: string,
    membershipId: string,
    commandId: string,
    nfcTagId: string,
    expectedActiveAssignmentId: string,
    targetCustomerId: string,
  ): Promise<ApiResult<{ readonly assignmentChanged: boolean }>>;
  timeRecords(
    token: string,
    membershipId: string,
    fromInclusive: string,
    toExclusive: string,
    nextCursor: string | null,
  ): Promise<ApiResult<CursorPage<SafeTimeRecord>>>;
  reviewItems(
    token: string,
    membershipId: string,
    nextCursor: string | null,
  ): Promise<ApiResult<CursorPage<SafeReviewItem>>>;
  correctTimeRecord(
    token: string,
    membershipId: string,
    commandId: string,
    record: SafeTimeRecord,
    startedAt: string,
    stoppedAt: string,
    reason: string,
  ): Promise<ApiResult<true>>;
  adjudicateReviewItem(
    token: string,
    membershipId: string,
    commandId: string,
    reviewItemId: string,
    resolution: object,
    reason: string,
  ): Promise<ApiResult<true>>;
  exportTimeEntries(
    token: string,
    membershipId: string,
    fromInclusive: string,
    toExclusive: string,
  ): Promise<ApiResult<{ readonly blob: Blob; readonly filename: string }>>;
  readonly projects?: (
    token: string,
    membershipId: string,
    nextCursor: string | null,
  ) => Promise<ApiResult<CursorPage<SafeProject>>>;
  readonly createProject?: (
    token: string,
    membershipId: string,
    commandId: string,
    projectId: string,
    displayName: string,
  ) => Promise<ApiResult<SafeProject>>;
  readonly deactivateProject?: (
    token: string,
    membershipId: string,
    commandId: string,
    project: SafeProject,
  ) => Promise<ApiResult<SafeProject>>;
}

export class AdminWebApiClient implements AdminWebApiPort {
  constructor(private readonly fetchRequest: typeof fetch = (input, init) => globalThis.fetch(input, init)) {}
  async session(token: string): Promise<ApiResult<Session>> { return this.request('/v1/session', token, 'GET', undefined, parseSession); }
  async projection(token: string, membershipId: string, nextCursor: string | null): Promise<ApiResult<SafeProjection>> {
    if (nextCursor !== null && !cursor.test(nextCursor)) return { status: 'unavailable' };
    return this.request('/v1/administration/setup-projection', token, 'POST', { expectedMembershipId: membershipId, cursor: nextCursor, limit: 20 }, parseProjection);
  }
  async createCustomer(token: string, membershipId: string, commandId: string, displayName: string): Promise<ApiResult<true>> {
    return this.request('/v1/administration/customers', token, 'POST', { expectedMembershipId: membershipId, commandId, displayName }, (value) => {
      if (!isRecord(value) || !exact(value, ['status', 'idempotentRetry', 'customer'])
        || value.status !== 'succeeded' || typeof value.idempotentRetry !== 'boolean'
        || !isRecord(value.customer) || !exact(value.customer, ['id', 'displayName', 'active'])
        || !uuid.test(String(value.customer.id)) || typeof value.customer.displayName !== 'string'
        || typeof value.customer.active !== 'boolean') return null;
      return true;
    });
  }
  async employeeProjection(token: string, membershipId: string, nextCursor: string | null): Promise<ApiResult<SafeEmployeeProjection>> {
    if (nextCursor !== null && !employeeCursor.test(nextCursor)) return { status: 'unavailable' };
    return this.request(
      '/v1/administration/employee-memberships-projection',
      token,
      'POST',
      { expectedMembershipId: membershipId, cursor: nextCursor, limit: 20 },
      (value) => parseEmployeeProjection(value, nextCursor),
    );
  }
  async createEmployeeInvitation(token: string, membershipId: string, commandId: string, displayName: string): Promise<ApiResult<VolatileInvitationSecret>> {
    return this.request(
      '/v1/administration/employee-invitations',
      token,
      'POST',
      { expectedMembershipId: membershipId, commandId, displayName },
      parseInvitation,
      true,
    );
  }
  async reassignNfcTag(
    token: string,
    membershipId: string,
    commandId: string,
    nfcTagId: string,
    expectedActiveAssignmentId: string,
    targetCustomerId: string,
  ): Promise<ApiResult<{ readonly assignmentChanged: boolean }>> {
    return this.request(
      '/v1/administration/nfc-tags/reassign',
      token,
      'POST',
      {
        expectedMembershipId: membershipId,
        commandId,
        nfcTagId,
        expectedActiveAssignmentId,
        targetCustomerId,
      },
      (value) => parseReassignment(
        value,
        expectedActiveAssignmentId,
        targetCustomerId,
      ),
      false,
      true,
    );
  }
  async timeRecords(
    token: string,
    membershipId: string,
    fromInclusive: string,
    toExclusive: string,
    nextCursor: string | null,
  ): Promise<ApiResult<CursorPage<SafeTimeRecord>>> {
    if (nextCursor !== null && !opaqueCursor.test(nextCursor)) return { status: 'unavailable' };
    return this.request(
      '/v2/administration/time-records/query', token, 'POST',
      { expectedMembershipId: membershipId, fromInclusive, toExclusive, limit: 100, cursor: nextCursor },
      parseTimeRecords,
      false,
      false,
      false,
      maximumTimeReviewBodyBytes,
    );
  }
  async reviewItems(
    token: string,
    membershipId: string,
    nextCursor: string | null,
  ): Promise<ApiResult<CursorPage<SafeReviewItem>>> {
    if (nextCursor !== null && !opaqueCursor.test(nextCursor)) return { status: 'unavailable' };
    return this.request(
      '/v2/administration/review-items/query', token, 'POST',
      { expectedMembershipId: membershipId, limit: 100, cursor: nextCursor },
      parseReviewItems,
      false,
      false,
      false,
      maximumTimeReviewBodyBytes,
    );
  }
  async correctTimeRecord(
    token: string,
    membershipId: string,
    commandId: string,
    record: SafeTimeRecord,
    startedAt: string,
    stoppedAt: string,
    reason: string,
  ): Promise<ApiResult<true>> {
    return this.request(
      '/v1/administration/time-records/correct', token, 'POST',
      {
        expectedMembershipId: membershipId,
        commandId,
        timeRecordId: record.timeRecordId,
        expectedBaseRowVersion: record.baseRowVersion,
        expectedRevisionNumber: record.effectiveRevisionNumber,
        startedAt,
        stoppedAt,
        reason,
      },
      parseCommittedWrite,
      false,
      false,
      true,
    );
  }
  async adjudicateReviewItem(
    token: string,
    membershipId: string,
    commandId: string,
    reviewItemId: string,
    resolution: object,
    reason: string,
  ): Promise<ApiResult<true>> {
    return this.request(
      '/v1/administration/review-items/adjudicate', token, 'POST',
      {
        expectedMembershipId: membershipId,
        commandId,
        reviewItemIds: [reviewItemId],
        resolution,
        reason,
      },
      parseCommittedWrite,
      false,
      false,
      true,
    );
  }
  async exportTimeEntries(
    token: string,
    membershipId: string,
    fromInclusive: string,
    toExclusive: string,
  ): Promise<ApiResult<{ readonly blob: Blob; readonly filename: string }>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchRequest('/v2/time-entries/export', {
        method: 'POST',
        headers: {
          Accept: 'text/csv', Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store', 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expectedMembershipId: membershipId, fromInclusive, toExclusive }),
        cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) return { status: 'rejected' };
      const disposition = response.headers.get('content-disposition');
      const match = /^attachment; filename="(taptime-time-entries_v2_[0-9TZ]+_[0-9TZ]+\.csv)"$/.exec(
        disposition ?? '',
      );
      if (
        response.status !== 200 || response.redirected
        || response.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'text/csv'
        || !hasSafeDeclaredLength(response, maximumCsvBodyBytes)
        || match === null
      ) return { status: 'unavailable' };
      const blob = await readBoundedResponseBlob(response, maximumCsvBodyBytes);
      if (blob === null) return { status: 'unavailable' };
      return { status: 'succeeded', value: { blob, filename: match[1]! } };
    } catch {
      return { status: 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
  async projects(
    token: string,
    membershipId: string,
    nextCursor: string | null,
  ): Promise<ApiResult<CursorPage<SafeProject>>> {
    if (nextCursor !== null && !projectCursor.test(nextCursor)) {
      return { status: 'unavailable' };
    }
    return this.request(
      '/v1/administration/projects/query',
      token,
      'POST',
      { expectedMembershipId: membershipId, cursor: nextCursor, limit: 20 },
      parseProjects,
      false,
      false,
      false,
      maximumJsonBodyBytes,
    );
  }
  async createProject(
    token: string,
    membershipId: string,
    commandId: string,
    projectId: string,
    displayName: string,
  ): Promise<ApiResult<SafeProject>> {
    return this.request(
      '/v1/administration/projects/create',
      token,
      'POST',
      { expectedMembershipId: membershipId, commandId, projectId, displayName },
      parseProjectMutation,
      false,
      false,
      false,
      maximumJsonBodyBytes,
      true,
    );
  }
  async deactivateProject(
    token: string,
    membershipId: string,
    commandId: string,
    project: SafeProject,
  ): Promise<ApiResult<SafeProject>> {
    return this.request(
      '/v1/administration/projects/deactivate',
      token,
      'POST',
      {
        expectedMembershipId: membershipId,
        commandId,
        projectId: project.projectId,
        expectedRowVersion: project.rowVersion,
      },
      parseProjectMutation,
      false,
      false,
      false,
      maximumJsonBodyBytes,
      true,
    );
  }
  private async request<Value>(
    path: string,
    token: string,
    method: 'GET' | 'POST',
    body: object | undefined,
    parse: (value: unknown) => Value | null,
    exposeInvitationConflicts = false,
    exposeReassignmentErrors = false,
    exposeTimeReviewErrors = false,
    maximumResponseBytes = maximumJsonBodyBytes,
    exposeProjectErrors = false,
  ): Promise<ApiResult<Value>> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchRequest(path, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: controller.signal });
      if (response.status === 401 || response.status === 403) return { status: 'rejected' };
      if (exposeInvitationConflicts && response.status === 409) {
        if (
          response.redirected
          || !isJsonContentType(response.headers.get('content-type'))
          || !hasSafeDeclaredLength(response, maximumResponseBytes)
        ) return { status: 'unavailable' };
        const conflictText = await readBoundedResponseText(response, maximumResponseBytes);
        if (conflictText === null) return { status: 'unavailable' };
        const code = parseInvitationConflict(JSON.parse(conflictText));
        return code === null ? { status: 'unavailable' } : { status: 'conflict', code };
      }
      if (exposeReassignmentErrors && (response.status === 404 || response.status === 409)) {
        if (
          response.redirected
          || !isJsonContentType(response.headers.get('content-type'))
          || !hasSafeDeclaredLength(response, maximumResponseBytes)
        ) return { status: 'unavailable' };
        const conflictText = await readBoundedResponseText(response, maximumResponseBytes);
        if (conflictText === null) return { status: 'unavailable' };
        const code = parseReassignmentError(JSON.parse(conflictText), response.status);
        return code === null ? { status: 'unavailable' } : { status: 'conflict', code };
      }
      if (exposeTimeReviewErrors && (response.status === 409 || response.status === 422)) {
        if (
          response.redirected
          || !isJsonContentType(response.headers.get('content-type'))
          || !hasSafeDeclaredLength(response, maximumResponseBytes)
        ) return { status: 'unavailable' };
        const conflictText = await readBoundedResponseText(response, maximumResponseBytes);
        if (conflictText === null) return { status: 'unavailable' };
        const code = parseTimeReviewError(JSON.parse(conflictText), response.status);
        return code === null ? { status: 'unavailable' } : { status: 'conflict', code };
      }
      if (exposeProjectErrors && (response.status === 404 || response.status === 409)) {
        if (
          response.redirected
          || !isJsonContentType(response.headers.get('content-type'))
          || !hasSafeDeclaredLength(response, maximumResponseBytes)
        ) return { status: 'unavailable' };
        const conflictText = await readBoundedResponseText(response, maximumResponseBytes);
        if (conflictText === null) return { status: 'unavailable' };
        const code = parseProjectError(JSON.parse(conflictText));
        return code === null ? { status: 'unavailable' } : { status: 'conflict', code };
      }
      if (response.status !== 200 || response.redirected || !isJsonContentType(response.headers.get('content-type'))) return { status: 'unavailable' };
      if (!hasSafeDeclaredLength(response, maximumResponseBytes)) return { status: 'unavailable' };
      const text = await readBoundedResponseText(response, maximumResponseBytes);
      if (text === null) return { status: 'unavailable' };
      const value = parse(JSON.parse(text)); return value === null ? { status: 'unavailable' } : { status: 'succeeded', value };
    } catch { return { status: 'unavailable' }; } finally { clearTimeout(timeout); }
  }
}

function parseSession(value: unknown): Session | null { if (!isRecord(value) || !exact(value, ['userId', 'membershipId', 'organizationId', 'role']) || !uuid.test(String(value.userId)) || !uuid.test(String(value.membershipId)) || !uuid.test(String(value.organizationId)) || (value.role !== 'administrator' && value.role !== 'employee')) return null; return { membershipId: String(value.membershipId), role: value.role }; }
function parseProjection(value: unknown): SafeProjection | null {
  if (!isRecord(value) || !exact(value, ['status', 'organization', 'customers', 'nfcTags', 'nextCursor']) || value.status !== 'succeeded' || !isRecord(value.organization) || !exact(value.organization, ['id', 'name']) || !uuid.test(String(value.organization.id)) || typeof value.organization.name !== 'string' || !Array.isArray(value.customers) || !Array.isArray(value.nfcTags) || !(value.nextCursor === null || (typeof value.nextCursor === 'string' && cursor.test(value.nextCursor)))) return null;
  const customers = value.customers.map((x) => isRecord(x) && exact(x, ['id', 'displayName', 'active']) && uuid.test(String(x.id)) && typeof x.displayName === 'string' && typeof x.active === 'boolean' ? { id: String(x.id), displayName: x.displayName, active: x.active } : null);
  const tags = value.nfcTags.map((x) => isRecord(x)
    && exact(x, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'targetCustomerId', 'activeAssignmentId'])
    && uuid.test(String(x.id))
    && typeof x.displayName === 'string'
    && fingerprint.test(String(x.validationFingerprint))
    && (x.assignmentState === 'assigned' || x.assignmentState === 'unassigned')
    && (x.targetCustomerId === null || uuid.test(String(x.targetCustomerId)))
    && (x.activeAssignmentId === null || uuid.test(String(x.activeAssignmentId)))
    && (
      (x.assignmentState === 'assigned' && x.targetCustomerId !== null && x.activeAssignmentId !== null)
      || (x.assignmentState === 'unassigned' && x.targetCustomerId === null && x.activeAssignmentId === null)
    )
    ? {
        id: String(x.id),
        displayName: x.displayName,
        validationFingerprint: String(x.validationFingerprint),
        assignmentState: x.assignmentState,
        targetCustomerId: x.targetCustomerId === null ? null : String(x.targetCustomerId),
        activeAssignmentId: x.activeAssignmentId === null ? null : String(x.activeAssignmentId),
      }
    : null);
  if (customers.some((x) => x === null) || tags.some((x) => x === null)) return null;
  return { organization: { id: String(value.organization.id), name: value.organization.name }, customers: customers as SafeProjection['customers'], nfcTags: tags as SafeProjection['nfcTags'], nextCursor: value.nextCursor };
}
function parseEmployeeProjection(
  value: unknown,
  requestedCursor: string | null,
): SafeEmployeeProjection | null {
  if (!isRecord(value) || !exact(value, ['status', 'organization', 'employeeMemberships', 'nextCursor'])
    || value.status !== 'succeeded' || !isRecord(value.organization)
    || !exact(value.organization, ['id', 'name']) || !uuid.test(String(value.organization.id))
    || typeof value.organization.name !== 'string' || !Array.isArray(value.employeeMemberships)
    || !(value.nextCursor === null || (typeof value.nextCursor === 'string' && employeeCursor.test(value.nextCursor)))) return null;
  const memberships = value.employeeMemberships.map((entry) => isRecord(entry)
    && exact(entry, ['id', 'displayName', 'role', 'active'])
    && uuid.test(String(entry.id)) && typeof entry.displayName === 'string'
    && entry.role === 'employee' && entry.active === true
    ? { id: String(entry.id), displayName: entry.displayName, role: 'employee' as const, active: true as const }
    : null);
  if (memberships.some((entry) => entry === null)) return null;
  const projection: SafeEmployeeProjection = {
    organization: { id: String(value.organization.id), name: value.organization.name },
    employeeMemberships: memberships as SafeEmployeeProjection['employeeMemberships'],
    nextCursor: value.nextCursor,
  };
  return isSafeEmployeeProjectionPage(projection, requestedCursor) ? projection : null;
}
function parseProjects(value: unknown): CursorPage<SafeProject> | null {
  if (
    !isRecord(value)
    || !exact(value, ['projects', 'nextCursor'])
    || !Array.isArray(value.projects)
    || !(value.nextCursor === null || (
      typeof value.nextCursor === 'string' && projectCursor.test(value.nextCursor)
    ))
  ) return null;
  const projects = value.projects.map(parseProject);
  return projects.some((project) => project === null)
    ? null
    : {
        items: projects as SafeProject[],
        nextCursor: value.nextCursor,
      };
}
function parseProjectMutation(value: unknown): SafeProject | null {
  if (
    !isRecord(value)
    || !exact(value, ['status', 'idempotentRetry', 'project', 'receiptId'])
    || value.status !== 'succeeded'
    || typeof value.idempotentRetry !== 'boolean'
    || !uuid.test(String(value.receiptId))
  ) return null;
  return parseProject(value.project);
}
function parseProject(value: unknown): SafeProject | null {
  if (
    !isRecord(value)
    || !exact(value, ['projectId', 'displayName', 'active', 'rowVersion'])
    || !uuid.test(String(value.projectId))
    || typeof value.displayName !== 'string'
    || typeof value.active !== 'boolean'
    || !Number.isSafeInteger(value.rowVersion)
    || Number(value.rowVersion) < 1
  ) return null;
  return {
    projectId: String(value.projectId),
    displayName: value.displayName,
    active: value.active,
    rowVersion: Number(value.rowVersion),
  };
}
function parseInvitation(value: unknown): VolatileInvitationSecret | null {
  if (!isRecord(value) || !exact(value, ['status', 'invitationSecret', 'expiresAt'])
    || value.status !== 'succeeded' || typeof value.invitationSecret !== 'string'
    || !invitationSecret.test(value.invitationSecret) || typeof value.expiresAt !== 'string'
    || !canonicalTimestamp.test(value.expiresAt) || new Date(value.expiresAt).toISOString() !== value.expiresAt) return null;
  const binary = atob(value.invitationSecret.replaceAll('-', '+').replaceAll('_', '/') + '=');
  const decoded = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (decoded.length !== 32 || encoded !== value.invitationSecret) return null;
  return { value: value.invitationSecret, expiresAt: value.expiresAt };
}
function parseReassignment(
  value: unknown,
  expectedActiveAssignmentId: string,
  expectedTargetCustomerId: string,
): { readonly assignmentChanged: boolean } | null {
  if (
    !isRecord(value)
    || !exact(value, [
      'status',
      'idempotentRetry',
      'assignmentChanged',
      'resultAssignmentId',
      'replacedAssignmentId',
      'targetCustomerId',
      'effectiveAt',
    ])
    || value.status !== 'succeeded'
    || typeof value.idempotentRetry !== 'boolean'
    || typeof value.assignmentChanged !== 'boolean'
    || !uuid.test(String(value.resultAssignmentId))
    || !(value.replacedAssignmentId === null || uuid.test(String(value.replacedAssignmentId)))
    || !uuid.test(String(value.targetCustomerId))
    || value.targetCustomerId !== expectedTargetCustomerId
    || !(value.effectiveAt === null || (
      typeof value.effectiveAt === 'string'
      && canonicalTimestamp.test(value.effectiveAt)
      && new Date(value.effectiveAt).toISOString() === value.effectiveAt
    ))
    || (
      value.assignmentChanged
        ? value.replacedAssignmentId !== expectedActiveAssignmentId
          || value.resultAssignmentId === expectedActiveAssignmentId
          || value.effectiveAt === null
        : value.resultAssignmentId !== expectedActiveAssignmentId
          || value.replacedAssignmentId !== null
          || value.effectiveAt !== null
    )
  ) return null;
  return { assignmentChanged: value.assignmentChanged };
}
function parseTimeRecords(value: unknown): CursorPage<SafeTimeRecord> | null {
  if (!isRecord(value) || !exact(value, ['status', 'records', 'nextCursor'])
    || value.status !== 'ready' || !Array.isArray(value.records)
    || !(value.nextCursor === null || (typeof value.nextCursor === 'string' && opaqueCursor.test(value.nextCursor)))) return null;
  const records = value.records.map((entry) => {
    if (!isRecord(entry) || !exact(entry, [
      'timeRecordId', 'employeeMembershipId', 'employeeDisplayName', 'targetType',
      'targetId', 'targetDisplayName', 'source', 'status', 'startedVia', 'stoppedVia',
      'startedAt', 'stoppedAt',
      'baseRowVersion', 'effectiveRevisionNumber', 'overlapsAnotherRecord',
    ]) || !uuid.test(String(entry.timeRecordId)) || !uuid.test(String(entry.employeeMembershipId))
      || !uuid.test(String(entry.targetId)) || typeof entry.employeeDisplayName !== 'string'
      || typeof entry.targetDisplayName !== 'string'
      || !['customer', 'project', 'general_work'].includes(String(entry.targetType))
      || (entry.source !== 'canonical' && entry.source !== 'recovered')
      || (entry.status !== 'started' && entry.status !== 'stopped')
      || !(entry.startedVia === null || entry.startedVia === 'nfc' || entry.startedVia === 'manual')
      || !(entry.stoppedVia === null || entry.stoppedVia === 'nfc' || entry.stoppedVia === 'manual')
      || (entry.source === 'recovered'
        ? entry.startedVia !== null || entry.stoppedVia !== null
        : entry.startedVia === null
          || (entry.status === 'started' ? entry.stoppedVia !== null : entry.stoppedVia === null))
      || !isCanonicalTimestamp(entry.startedAt)
      || !(entry.stoppedAt === null || isCanonicalTimestamp(entry.stoppedAt))
      || (entry.status === 'started' ? entry.stoppedAt !== null : entry.stoppedAt === null)
      || !isNonNegativeInteger(entry.baseRowVersion)
      || !isNonNegativeInteger(entry.effectiveRevisionNumber)
      || typeof entry.overlapsAnotherRecord !== 'boolean') return null;
    return Object.freeze({
      timeRecordId: String(entry.timeRecordId),
      employeeDisplayName: entry.employeeDisplayName,
      targetType: entry.targetType as SafeTimeRecord['targetType'],
      targetDisplayName: entry.targetDisplayName,
      startedVia: entry.startedVia as SafeTimeRecord['startedVia'],
      stoppedVia: entry.stoppedVia as SafeTimeRecord['stoppedVia'],
      source: entry.source,
      status: entry.status,
      startedAt: entry.startedAt,
      stoppedAt: entry.stoppedAt,
      baseRowVersion: entry.baseRowVersion,
      effectiveRevisionNumber: entry.effectiveRevisionNumber,
      overlapsAnotherRecord: entry.overlapsAnotherRecord,
    });
  });
  return records.some((entry) => entry === null)
    ? null
    : Object.freeze({
        items: Object.freeze(records as SafeTimeRecord[]),
        nextCursor: value.nextCursor as string | null,
      });
}
function parseReviewItems(value: unknown): CursorPage<SafeReviewItem> | null {
  if (!isRecord(value) || !exact(value, ['status', 'items', 'nextCursor'])
    || value.status !== 'ready' || !Array.isArray(value.items)
    || !(value.nextCursor === null || (typeof value.nextCursor === 'string' && opaqueCursor.test(value.nextCursor)))) return null;
  const reasons = new Set([
    'identity_or_membership_not_current', 'capture_time_out_of_bounds',
    'automatic_window_elapsed', 'historical_configuration_not_valid',
    'predecessor_requires_review', 'server_lifecycle_deferred',
  ]);
  const items = value.items.map((entry) => {
    if (!isRecord(entry) || !exact(entry, [
      'reviewItemId', 'source', 'employeeUserId', 'employeeMembershipId',
      'employeeDisplayName', 'targetType', 'targetId', 'targetDisplayName', 'triggerType', 'occurredAt',
      'recordedAt', 'reviewReason', 'deviceSequence', 'predecessorBlocked',
    ]) || !uuid.test(String(entry.reviewItemId)) || !uuid.test(String(entry.employeeUserId))
      || !uuid.test(String(entry.employeeMembershipId)) || !uuid.test(String(entry.targetId))
      || typeof entry.employeeDisplayName !== 'string' || typeof entry.targetDisplayName !== 'string'
      || !['customer', 'project', 'general_work'].includes(String(entry.targetType))
      || (entry.triggerType !== 'nfc' && entry.triggerType !== 'manual')
      || (entry.source !== 'offline_v2' && entry.source !== 'server_legacy')
      || !isCanonicalTimestamp(entry.occurredAt) || !isCanonicalTimestamp(entry.recordedAt)
      || typeof entry.reviewReason !== 'string' || !reasons.has(entry.reviewReason)
      || !(entry.deviceSequence === null || (Number.isSafeInteger(entry.deviceSequence) && Number(entry.deviceSequence) >= 1))
      || typeof entry.predecessorBlocked !== 'boolean') return null;
    return Object.freeze({
      reviewItemId: String(entry.reviewItemId), source: entry.source,
      employeeDisplayName: entry.employeeDisplayName,
      targetType: entry.targetType as SafeReviewItem['targetType'],
      targetDisplayName: entry.targetDisplayName,
      triggerType: entry.triggerType as SafeReviewItem['triggerType'],
      occurredAt: entry.occurredAt, reviewReason: entry.reviewReason,
      deviceSequence: entry.deviceSequence,
      predecessorBlocked: entry.predecessorBlocked,
    });
  });
  return items.some((entry) => entry === null)
    ? null
    : Object.freeze({
        items: Object.freeze(items as SafeReviewItem[]),
        nextCursor: value.nextCursor as string | null,
      });
}
function parseCommittedWrite(value: unknown): true | null {
  if (!isRecord(value) || value.status !== 'committed' || typeof value.idempotentRetry !== 'boolean') return null;
  if (exact(value, [
    'status', 'timeRecordId', 'revisionNumber', 'startedAt', 'stoppedAt', 'idempotentRetry',
  ])) {
    return uuid.test(String(value.timeRecordId)) && isNonNegativeInteger(value.revisionNumber)
      && isCanonicalTimestamp(value.startedAt) && isCanonicalTimestamp(value.stoppedAt)
      ? true : null;
  }
  if (!exact(value, [
    'status', 'commandId', 'resolution', 'adjudicatedReviewItemIds', 'timeRecordId',
    'revisionNumber', 'idempotentRetry',
  ]) || !uuid.test(String(value.commandId))
    || !Array.isArray(value.adjudicatedReviewItemIds)
    || value.adjudicatedReviewItemIds.length < 1
    || value.adjudicatedReviewItemIds.some((id) => !uuid.test(String(id)))
    || !['no_time_record_change', 'adjust_existing_time_record', 'create_recovered_time_record'].includes(String(value.resolution))
    || !(value.timeRecordId === null || uuid.test(String(value.timeRecordId)))
    || !(value.revisionNumber === null || isNonNegativeInteger(value.revisionNumber))) return null;
  return true;
}
function parseInvitationConflict(value: unknown): 'command_id_conflict' | 'invitation_created_token_unavailable' | 'invitation_limit_reached' | null {
  if (!isRecord(value) || !exact(value, ['error']) || !isRecord(value.error) || !exact(value.error, ['code'])) return null;
  return value.error.code === 'command_id_conflict'
    || value.error.code === 'invitation_created_token_unavailable'
    || value.error.code === 'invitation_limit_reached'
    ? value.error.code
    : null;
}
function parseReassignmentError(
  value: unknown,
  status: number,
): 'assignment_conflict' | 'assignment_in_use' | 'assignment_target_unavailable' | 'command_id_conflict' | null {
  if (!isRecord(value) || !exact(value, ['error']) || !isRecord(value.error) || !exact(value.error, ['code'])) return null;
  if (status === 404) {
    return value.error.code === 'assignment_target_unavailable'
      ? 'assignment_target_unavailable'
      : null;
  }
  return value.error.code === 'assignment_conflict'
    || value.error.code === 'assignment_in_use'
    || value.error.code === 'command_id_conflict'
    ? value.error.code
    : null;
}
function parseTimeReviewError(
  value: unknown,
  status: number,
): 'command_id_conflict' | 'time_review_conflict' | 'not_adjustable' | 'invalid_evidence' | null {
  if (!isRecord(value) || !exact(value, ['error']) || !isRecord(value.error)
    || !exact(value.error, ['code'])) return null;
  if (status === 409) {
    if (value.error.code === 'command_id_conflict') return 'command_id_conflict';
    return value.error.code === 'conflict' ? 'time_review_conflict' : null;
  }
  return value.error.code === 'not_adjustable' || value.error.code === 'invalid_evidence'
    ? value.error.code : null;
}
function parseProjectError(
  value: unknown,
): 'command_id_conflict' | 'project_in_use' | 'project_unavailable'
  | 'stale_row_version' | null {
  if (
    !isRecord(value)
    || !exact(value, ['error'])
    || !isRecord(value.error)
    || !exact(value.error, ['code'])
  ) return null;
  return value.error.code === 'command_id_conflict'
    || value.error.code === 'project_in_use'
    || value.error.code === 'project_unavailable'
    || value.error.code === 'stale_row_version'
    ? value.error.code
    : null;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).sort().join(',') === [...keys].sort().join(','); }

function isJsonContentType(value: string | null): boolean {
  return value !== null && value.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function hasSafeDeclaredLength(response: Response, maximumBytes = maximumJsonBodyBytes): boolean {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength === null) return true;
  const length = Number(declaredLength);
  return Number.isSafeInteger(length) && length >= 0 && length <= maximumBytes;
}

async function readBoundedResponseText(
  response: Response,
  maximumBytes = maximumJsonBodyBytes,
): Promise<string | null> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) {
        try { await reader.cancel('TapTim.e response body exceeded its byte limit'); } catch { /* best-effort cleanup */ }
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* a failed or canceled stream has no usable data */ }
  }
}

async function readBoundedResponseBlob(
  response: Response,
  maximumBytes: number,
): Promise<Blob | null> {
  if (response.body === null) return new Blob([], { type: 'text/csv' });
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return new Blob(chunks, { type: 'text/csv' });
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) {
        try { await reader.cancel('TapTim.e CSV response exceeded its byte limit'); } catch { /* best-effort cleanup */ }
        return null;
      }
      const copy = new Uint8Array(new ArrayBuffer(chunk.value.byteLength));
      copy.set(chunk.value);
      chunks.push(copy.buffer);
    }
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* a failed or canceled stream has no usable data */ }
  }
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === 'string' && canonicalTimestamp.test(value)
    && new Date(value).toISOString() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

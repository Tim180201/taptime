import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { TextDecoder } from 'node:util';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  WorkEventId,
  createNfcPayload,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import type { LifecycleIngestionCommand } from '@taptime/backend-lifecycle';
import type {
  BackendApiDependencies,
  BackendApiDiagnostic,
  BackendApiDiagnosticSink,
} from './types.js';

const SESSION_PATH = '/v1/session';
const SCAN_CONTEXT_PATH = '/v1/scan-context/resolve';
const LIFECYCLE_PATH = '/v1/lifecycle-events';
const DEFERRED_LIFECYCLE_PATH = '/v1/lifecycle-events/deferred';
const ADMIN_CUSTOMERS_PATH = '/v1/administration/customers';
const ADMIN_NFC_PROVISION_PATH = '/v1/administration/nfc-tags/provision';
const ADMIN_NFC_REASSIGN_PATH = '/v1/administration/nfc-tags/reassign';
const ADMIN_SETUP_PROJECTION_PATH = '/v1/administration/setup-projection';
const ADMIN_EMPLOYEE_INVITATIONS_PATH = '/v1/administration/employee-invitations';
const ADMIN_EMPLOYEE_MEMBERSHIPS_PROJECTION_PATH = '/v1/administration/employee-memberships-projection';
const EMPLOYEE_ENROLLMENT_REDEEM_PATH = '/v1/employee-enrollment/redeem';
const EXPECTED_MEMBERSHIP_HEADER = 'x-taptime-expected-membership-id';
const MAX_AUTHORIZATION_LENGTH = 4_096;
const MAX_BODY_BYTES = 16 * 1_024;
const MAX_HEADER_BYTES = 8_192;
const MAX_HEADER_COUNT = 64;
const MAX_SCAN_PAYLOAD_BYTES = 1_024;
const DEFAULT_OPERATION_TIMEOUT_MILLISECONDS = 10_000;
const compactJwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isoTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

type ErrorCode =
  | 'assignment_conflict'
  | 'assignment_in_use'
  | 'assignment_target_unavailable'
  | 'command_id_conflict'
  | 'forbidden'
  | 'enrollment_unavailable'
  | 'invalid_request'
  | 'method_not_allowed'
  | 'not_found'
  | 'service_unavailable'
  | 'invitation_created_token_unavailable'
  | 'invitation_limit_reached'
  | 'tag_payload_already_registered'
  | 'unauthorized';

type Route =
  | 'admin_create_customer'
  | 'admin_create_employee_invitation'
  | 'admin_employee_memberships_projection'
  | 'admin_provision_nfc_tag'
  | 'admin_reassign_nfc_tag'
  | 'admin_setup_projection'
  | 'deferred_lifecycle'
  | 'employee_enrollment_redeem'
  | 'lifecycle'
  | 'scan_context'
  | 'session';

export interface BackendHttpServerOptions {
  readonly onDiagnostic?: BackendApiDiagnosticSink;
  readonly operationTimeoutMilliseconds?: number;
}

export function createBackendHttpServer(
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions = {},
): Server {
  const timeoutMilliseconds = validateTimeout(
    options.operationTimeoutMilliseconds ?? DEFAULT_OPERATION_TIMEOUT_MILLISECONDS,
  );
  const server = createServer({ maxHeaderSize: MAX_HEADER_BYTES }, (request, response) => {
    const correlationId = randomUUID();
    applyResponseHeaders(response, correlationId);
    void handleRequest(
      request,
      response,
      dependencies,
      options,
      timeoutMilliseconds,
      correlationId,
    )
      .catch(() => {
        const code = diagnosticCodeForRoute(requestRoute(request.url));
        if (code !== null) {
          emitDiagnostic(options.onDiagnostic, { code, correlationId });
        }
        if (!response.writableEnded && !response.destroyed) {
          respondError(response, 503, 'service_unavailable');
        }
      });
  });
  server.maxHeadersCount = MAX_HEADER_COUNT;
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on('clientError', (_error, socket) => {
    if (!socket.writable) {
      return;
    }
    const correlationId = randomUUID();
    socket.end(
      'HTTP/1.1 400 Bad Request\r\n'
      + 'Connection: close\r\n'
      + 'Cache-Control: no-store\r\n'
      + 'Content-Type: application/json; charset=utf-8\r\n'
      + `X-Request-Id: ${correlationId}\r\n`
      + 'X-Content-Type-Options: nosniff\r\n'
      + '\r\n'
      + JSON.stringify({ error: { code: 'invalid_request' } }),
    );
  });
  return server;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  timeoutMilliseconds: number,
  correlationId: string,
): Promise<void> {
  const route = requestRoute(request.url);
  if (route === null) {
    request.resume();
    respondError(response, 404, 'not_found');
    return;
  }

  const expectedMethod = route === 'session' ? 'GET' : 'POST';
  if (request.method !== expectedMethod) {
    request.resume();
    response.setHeader('Allow', expectedMethod);
    respondError(response, 405, 'method_not_allowed');
    return;
  }

  if (request.rawHeaders.length / 2 > MAX_HEADER_COUNT || hasForbiddenSharedHeader(request)) {
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }
  if (
    (isAdministrationRoute(route) || route === 'employee_enrollment_redeem')
    && rawHeaderValues(request, EXPECTED_MEMBERSHIP_HEADER).length > 0
  ) {
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }

  if (route === 'session' && requestHasBody(request)) {
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }
  if (route !== 'session' && !hasValidJsonBodyHeaders(request)) {
    response.setHeader('Connection', 'close');
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }

  const accessToken = bearerToken(request);
  if (accessToken === null) {
    request.resume();
    respondError(response, 401, 'unauthorized');
    return;
  }

  if (route === 'session') {
    await handleSession(
      response,
      accessToken,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }

  const expectedMembershipId = route === 'lifecycle' || route === 'deferred_lifecycle'
    ? expectedMembershipHeader(request, route === 'deferred_lifecycle')
    : undefined;
  if (expectedMembershipId === null) {
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }

  let body: unknown;
  try {
    body = parseJson(await readBoundedBody(request));
  } catch {
    if (!response.destroyed) {
      response.setHeader('Connection', 'close');
      respondError(response, 400, 'invalid_request');
    }
    return;
  }

  if (route === 'admin_create_customer') {
    await handleCreateCustomer(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'admin_create_employee_invitation') {
    await handleCreateEmployeeInvitation(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'admin_employee_memberships_projection') {
    await handleEmployeeMembershipsProjection(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'employee_enrollment_redeem') {
    await handleEmployeeEnrollmentRedemption(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'admin_provision_nfc_tag') {
    await handleProvisionNfcTag(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'admin_reassign_nfc_tag') {
    await handleReassignNfcTag(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'admin_setup_projection') {
    await handleSetupProjection(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'scan_context') {
    await handleScanContext(
      response,
      accessToken,
      body,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  if (route === 'deferred_lifecycle') {
    if (expectedMembershipId === undefined) {
      respondError(response, 400, 'invalid_request');
      return;
    }
    await handleDeferredLifecycle(
      response,
      accessToken,
      body,
      expectedMembershipId,
      dependencies,
      options,
      correlationId,
      timeoutMilliseconds,
    );
    return;
  }
  await handleLifecycle(
    response,
    accessToken,
    body,
    expectedMembershipId,
    dependencies,
    options,
    correlationId,
    timeoutMilliseconds,
  );
}

async function handleSession(
  response: ServerResponse,
  accessToken: string,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  try {
    const resolution = await withTimeout(
      dependencies.sessionAuthority.resolve(accessToken),
      timeoutMilliseconds,
    );
    if (resolution.status === 'rejected') {
      respondError(response, 401, 'unauthorized');
      return;
    }
    respondJson(response, 200, resolution.session);
  } catch {
    emitDiagnostic(options.onDiagnostic, {
      code: 'session_resolution_failed',
      correlationId,
    });
    respondError(response, 503, 'service_unavailable');
  }
}

async function handleCreateCustomer(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseCreateCustomerBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.administration.createCustomer(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      idempotentRetry: result.idempotentRetry,
      customer: {
        id: result.customer.id,
        displayName: result.customer.displayName,
        active: result.customer.active,
      },
    }),
  );
}

async function handleProvisionNfcTag(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseProvisionNfcTagBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.administration.provisionNfcTag(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      idempotentRetry: result.idempotentRetry,
      nfcTag: {
        id: result.nfcTag.id,
        displayName: result.nfcTag.displayName,
        validationFingerprint: result.nfcTag.validationFingerprint,
        assignmentState: result.nfcTag.assignmentState,
        targetCustomerId: result.nfcTag.targetCustomerId,
      },
      assignmentId: result.assignmentId,
    }),
  );
}

async function handleReassignNfcTag(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseReassignNfcTagBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.tagReassignment.reassignNfcTag(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      idempotentRetry: result.idempotentRetry,
      assignmentChanged: result.assignmentChanged,
      resultAssignmentId: result.resultAssignmentId,
      replacedAssignmentId: result.replacedAssignmentId,
      targetCustomerId: result.targetCustomerId,
      effectiveAt: result.effectiveAt,
    }),
  );
}

async function handleSetupProjection(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseSetupProjectionBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.administration.readSetupProjection(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
      },
      customers: result.customers.map((customer) => ({
        id: customer.id,
        displayName: customer.displayName,
        active: customer.active,
      })),
      nfcTags: result.nfcTags.map((nfcTag) => ({
        id: nfcTag.id,
        displayName: nfcTag.displayName,
        validationFingerprint: nfcTag.validationFingerprint,
        assignmentState: nfcTag.assignmentState,
        targetCustomerId: nfcTag.targetCustomerId,
        activeAssignmentId: nfcTag.activeAssignmentId,
      })),
      nextCursor: result.nextCursor,
    }),
  );
}

async function handleCreateEmployeeInvitation(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseCreateEmployeeInvitationBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }
  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.employeeEnrollment.createInvitation(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      invitationSecret: result.invitationSecret,
      expiresAt: result.expiresAt,
    }),
  );
}

async function handleEmployeeMembershipsProjection(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseEmployeeMembershipsProjectionBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }
  await handleAdministrationOperation(
    response,
    options,
    correlationId,
    timeoutMilliseconds,
    (deadlineEpochMilliseconds) => dependencies.employeeEnrollment.readEmployeeMembershipsProjection(
      { accessToken, ...command },
      { deadlineEpochMilliseconds },
    ),
    (result) => ({
      status: 'succeeded',
      organization: result.organization,
      employeeMemberships: result.employeeMemberships,
      nextCursor: result.nextCursor,
    }),
  );
}

async function handleEmployeeEnrollmentRedemption(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseEmployeeEnrollmentRedemptionBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }
  try {
    const deadlineEpochMilliseconds = Date.now() + timeoutMilliseconds;
    const result = await withTimeout(
      dependencies.employeeEnrollment.redeemInvitation(
        { accessToken, ...command },
        { deadlineEpochMilliseconds },
      ),
      timeoutMilliseconds,
    );
    switch (result.status) {
      case 'succeeded':
        respondJson(response, 200, result);
        return;
      case 'invalid_request':
        respondError(response, 400, 'invalid_request');
        return;
      case 'unauthorized':
        respondError(response, 401, 'unauthorized');
        return;
      case 'enrollment_unavailable':
        respondError(response, 404, 'enrollment_unavailable');
        return;
      default:
        return result satisfies never;
    }
  } catch {
    emitDiagnostic(options.onDiagnostic, { code: 'employee_enrollment_failed', correlationId });
    respondError(response, 503, 'service_unavailable');
  }
}

async function handleAdministrationOperation<Result extends { readonly status: string }>(
  response: ServerResponse,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
  operation: (deadlineEpochMilliseconds: number) => Promise<Result>,
  successResponse: (result: Extract<Result, { readonly status: 'succeeded' }>) => unknown,
): Promise<void> {
  try {
    const deadlineEpochMilliseconds = Date.now() + timeoutMilliseconds;
    if (!Number.isSafeInteger(deadlineEpochMilliseconds)) {
      throw new Error('Backend API administration deadline is outside the safe integer range');
    }
    const result = await withTimeout(
      operation(deadlineEpochMilliseconds),
      timeoutMilliseconds,
    );
    switch (result.status) {
      case 'succeeded':
        respondJson(
          response,
          200,
          successResponse(result as Extract<Result, { readonly status: 'succeeded' }>),
        );
        return;
      case 'invalid_request':
        respondError(response, 400, 'invalid_request');
        return;
      case 'unauthorized':
        respondError(response, 401, 'unauthorized');
        return;
      case 'forbidden':
        respondError(response, 403, 'forbidden');
        return;
      case 'assignment_target_unavailable':
        respondError(response, 404, 'assignment_target_unavailable');
        return;
      case 'assignment_conflict':
        respondError(response, 409, 'assignment_conflict');
        return;
      case 'assignment_in_use':
        respondError(response, 409, 'assignment_in_use');
        return;
      case 'tag_payload_already_registered':
        respondError(response, 409, 'tag_payload_already_registered');
        return;
      case 'command_id_conflict':
        respondError(response, 409, 'command_id_conflict');
        return;
      case 'invitation_created_token_unavailable':
        respondError(response, 409, 'invitation_created_token_unavailable');
        return;
      case 'invitation_limit_reached':
        respondError(response, 409, 'invitation_limit_reached');
        return;
      default:
        throw new Error('Administration coordinator returned an unsupported result');
    }
  } catch {
    emitDiagnostic(options.onDiagnostic, {
      code: 'administration_failed',
      correlationId,
    });
    respondError(response, 503, 'service_unavailable');
  }
}

async function handleScanContext(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseScanContextBody(body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  try {
    const resolution = await withTimeout(
      dependencies.scanContextResolver.resolve({ accessToken, ...command }),
      timeoutMilliseconds,
    );
    if (resolution.status === 'rejected') {
      respondError(response, 401, 'unauthorized');
      return;
    }
    if (resolution.status === 'not_resolved') {
      respondError(response, 404, 'not_found');
      return;
    }
    respondJson(response, 200, resolution.context);
  } catch {
    emitDiagnostic(options.onDiagnostic, {
      code: 'scan_context_resolution_failed',
      correlationId,
    });
    respondError(response, 503, 'service_unavailable');
  }
}

async function handleLifecycle(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  expectedMembershipId: MembershipId | undefined,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseLifecycleBody(accessToken, body);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  try {
    const result = await withTimeout(
      dependencies.lifecycleIngestor.ingest(command, expectedMembershipId),
      timeoutMilliseconds,
    );
    switch (result.status) {
      case 'synchronized':
        respondJson(response, 200, result);
        return;
      case 'deferred':
        respondJson(response, 202, result);
        return;
      case 'conflict':
        respondJson(response, 409, result);
        return;
      case 'rejected':
        respondError(response, 401, 'unauthorized');
        return;
      default:
        return result satisfies never;
    }
  } catch {
    emitDiagnostic(options.onDiagnostic, {
      code: 'lifecycle_ingestion_failed',
      correlationId,
    });
    respondError(response, 503, 'service_unavailable');
  }
}

async function handleDeferredLifecycle(
  response: ServerResponse,
  accessToken: string,
  body: unknown,
  expectedMembershipId: MembershipId,
  dependencies: BackendApiDependencies,
  options: BackendHttpServerOptions,
  correlationId: string,
  timeoutMilliseconds: number,
): Promise<void> {
  const command = parseLifecycleBody(accessToken, body, 1);
  if (command === null) {
    respondError(response, 400, 'invalid_request');
    return;
  }

  try {
    const result = await withTimeout(
      dependencies.deferredLifecycleIngestor.ingestDeferred(command, expectedMembershipId),
      timeoutMilliseconds,
    );
    switch (result.status) {
      case 'deferred':
        respondJson(response, 202, result);
        return;
      case 'conflict':
        respondJson(response, 409, result);
        return;
      case 'rejected':
        respondError(response, 401, 'unauthorized');
        return;
      default:
        return result satisfies never;
    }
  } catch {
    emitDiagnostic(options.onDiagnostic, {
      code: 'lifecycle_ingestion_failed',
      correlationId,
    });
    respondError(response, 503, 'service_unavailable');
  }
}

function requestRoute(url: string | undefined): Route | null {
  if (url === ADMIN_EMPLOYEE_INVITATIONS_PATH) {
    return 'admin_create_employee_invitation';
  }
  if (url === ADMIN_EMPLOYEE_MEMBERSHIPS_PROJECTION_PATH) {
    return 'admin_employee_memberships_projection';
  }
  if (url === EMPLOYEE_ENROLLMENT_REDEEM_PATH) {
    return 'employee_enrollment_redeem';
  }
  if (url === ADMIN_CUSTOMERS_PATH) {
    return 'admin_create_customer';
  }
  if (url === ADMIN_NFC_PROVISION_PATH) {
    return 'admin_provision_nfc_tag';
  }
  if (url === ADMIN_NFC_REASSIGN_PATH) {
    return 'admin_reassign_nfc_tag';
  }
  if (url === ADMIN_SETUP_PROJECTION_PATH) {
    return 'admin_setup_projection';
  }
  if (url === SESSION_PATH) {
    return 'session';
  }
  if (url === SCAN_CONTEXT_PATH) {
    return 'scan_context';
  }
  if (url === LIFECYCLE_PATH) {
    return 'lifecycle';
  }
  if (url === DEFERRED_LIFECYCLE_PATH) {
    return 'deferred_lifecycle';
  }
  return null;
}

function diagnosticCodeForRoute(route: Route | null): BackendApiDiagnostic['code'] | null {
  switch (route) {
    case 'admin_create_customer':
    case 'admin_create_employee_invitation':
    case 'admin_employee_memberships_projection':
    case 'admin_provision_nfc_tag':
    case 'admin_reassign_nfc_tag':
    case 'admin_setup_projection':
      return 'administration_failed';
    case 'employee_enrollment_redeem':
      return 'employee_enrollment_failed';
    case 'session':
      return 'session_resolution_failed';
    case 'scan_context':
      return 'scan_context_resolution_failed';
    case 'lifecycle':
    case 'deferred_lifecycle':
      return 'lifecycle_ingestion_failed';
    case null:
      return null;
    default:
      return route satisfies never;
  }
}

function isAdministrationRoute(route: Route): boolean {
  return route === 'admin_create_customer'
    || route === 'admin_create_employee_invitation'
    || route === 'admin_employee_memberships_projection'
    || route === 'admin_provision_nfc_tag'
    || route === 'admin_reassign_nfc_tag'
    || route === 'admin_setup_projection';
}

function hasForbiddenSharedHeader(request: IncomingMessage): boolean {
  return rawHeaderValues(request, 'content-encoding').length > 0
    || rawHeaderValues(request, 'cookie').length > 0;
}

function hasValidJsonBodyHeaders(request: IncomingMessage): boolean {
  const contentTypes = rawHeaderValues(request, 'content-type');
  if (contentTypes.length !== 1 || contentTypes[0]!.toLowerCase() !== 'application/json') {
    return false;
  }

  const contentLengths = rawHeaderValues(request, 'content-length');
  const transferEncodings = rawHeaderValues(request, 'transfer-encoding');
  if (contentLengths.length > 1 || transferEncodings.length > 1) {
    return false;
  }
  if (contentLengths.length === 1 && transferEncodings.length === 1) {
    return false;
  }
  if (contentLengths.length === 1) {
    const value = contentLengths[0]!;
    if (!/^(?:0|[1-9]\d*)$/.test(value)) {
      return false;
    }
    const size = Number(value);
    return Number.isSafeInteger(size) && size <= MAX_BODY_BYTES;
  }
  return transferEncodings.length === 0
    || transferEncodings[0]!.toLowerCase() === 'chunked';
}

function requestHasBody(request: IncomingMessage): boolean {
  if (rawHeaderValues(request, 'transfer-encoding').length > 0) {
    return true;
  }
  const contentLengths = rawHeaderValues(request, 'content-length');
  return contentLengths.length > 1
    || (contentLengths.length === 1 && contentLengths[0] !== '0');
}

function bearerToken(request: IncomingMessage): string | null {
  const values = rawHeaderValues(request, 'authorization');
  if (values.length !== 1) {
    return null;
  }
  const value = values[0]!;
  if (value.length > MAX_AUTHORIZATION_LENGTH) {
    return null;
  }
  const match = /^Bearer ([^\s]+)$/i.exec(value);
  if (match === null || !compactJwtPattern.test(match[1]!)) {
    return null;
  }
  return match[1]!;
}

function rawHeaderValues(request: IncomingMessage, name: string): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      values.push(request.rawHeaders[index + 1] ?? '');
    }
  }
  return values;
}

function expectedMembershipHeader(
  request: IncomingMessage,
  required: boolean,
): MembershipId | undefined | null {
  const values = rawHeaderValues(request, EXPECTED_MEMBERSHIP_HEADER);
  if (values.length === 0) {
    return required ? null : undefined;
  }
  if (values.length !== 1 || !isUuid(values[0])) {
    return null;
  }
  try {
    return MembershipId(values[0].toLowerCase());
  } catch {
    return null;
  }
}

async function readBoundedBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;

    const cleanup = (): void => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('aborted', onAborted);
      request.off('error', onError);
    };
    const fail = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      request.resume();
      reject(new Error('Invalid request body'));
    };
    const onData = (chunk: Buffer | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_BODY_BYTES) {
        fail();
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, bytes));
    };
    const onAborted = (): void => fail();
    const onError = (): void => fail();

    request.on('data', onData);
    request.once('end', onEnd);
    request.once('aborted', onAborted);
    request.once('error', onError);
  });
}

function parseJson(body: Buffer): unknown {
  const json = new TextDecoder('utf-8', { fatal: true }).decode(body);
  return JSON.parse(json) as unknown;
}

function parseCreateCustomerBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly displayName: string;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['commandId', 'displayName', 'expectedMembershipId'])
    || !isCanonicalUuid(body.expectedMembershipId)
    || !isCanonicalUuid(body.commandId)
    || typeof body.displayName !== 'string'
  ) {
    return null;
  }
  try {
    return {
      expectedMembershipId: MembershipId(body.expectedMembershipId),
      commandId: body.commandId,
      displayName: body.displayName,
    };
  } catch {
    return null;
  }
}

function parseProvisionNfcTagBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly customerId: CustomerId;
  readonly displayName: string;
  readonly canonicalPayload: string;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(
      body,
      ['canonicalPayload', 'commandId', 'customerId', 'displayName', 'expectedMembershipId'],
    )
    || !isCanonicalUuid(body.expectedMembershipId)
    || !isCanonicalUuid(body.commandId)
    || !isCanonicalUuid(body.customerId)
    || typeof body.displayName !== 'string'
    || typeof body.canonicalPayload !== 'string'
  ) {
    return null;
  }
  try {
    return {
      expectedMembershipId: MembershipId(body.expectedMembershipId),
      commandId: body.commandId,
      customerId: CustomerId(body.customerId),
      displayName: body.displayName,
      canonicalPayload: body.canonicalPayload,
    };
  } catch {
    return null;
  }
}

function parseReassignNfcTagBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly nfcTagId: NfcTagId;
  readonly expectedActiveAssignmentId: NfcAssignmentId;
  readonly targetCustomerId: CustomerId;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(
      body,
      [
        'commandId',
        'expectedActiveAssignmentId',
        'expectedMembershipId',
        'nfcTagId',
        'targetCustomerId',
      ],
    )
    || !isCanonicalUuid(body.expectedMembershipId)
    || !isCanonicalUuid(body.commandId)
    || !isCanonicalUuid(body.nfcTagId)
    || !isCanonicalUuid(body.expectedActiveAssignmentId)
    || !isCanonicalUuid(body.targetCustomerId)
  ) {
    return null;
  }
  try {
    return {
      expectedMembershipId: MembershipId(body.expectedMembershipId),
      commandId: body.commandId,
      nfcTagId: NfcTagId(body.nfcTagId),
      expectedActiveAssignmentId: NfcAssignmentId(body.expectedActiveAssignmentId),
      targetCustomerId: CustomerId(body.targetCustomerId),
    };
  } catch {
    return null;
  }
}

function parseSetupProjectionBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly cursor: string | null;
  readonly limit: number;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['cursor', 'expectedMembershipId', 'limit'])
    || !isCanonicalUuid(body.expectedMembershipId)
    || (body.cursor !== null && typeof body.cursor !== 'string')
    || (
      typeof body.cursor === 'string'
      && Buffer.byteLength(body.cursor, 'utf8') > 256
    )
    || !Number.isSafeInteger(body.limit)
    || (body.limit as number) < 1
    || (body.limit as number) > 20
  ) {
    return null;
  }
  try {
    return {
      expectedMembershipId: MembershipId(body.expectedMembershipId),
      cursor: body.cursor as string | null,
      limit: body.limit as number,
    };
  } catch {
    return null;
  }
}

function parseCreateEmployeeInvitationBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly commandId: string;
  readonly displayName: string;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['commandId', 'displayName', 'expectedMembershipId'])
    || !isCanonicalUuid(body.expectedMembershipId)
    || !isCanonicalUuid(body.commandId)
    || typeof body.displayName !== 'string'
  ) {
    return null;
  }
  return {
    expectedMembershipId: MembershipId(body.expectedMembershipId),
    commandId: body.commandId,
    displayName: body.displayName,
  };
}

function parseEmployeeMembershipsProjectionBody(body: unknown): {
  readonly expectedMembershipId: MembershipId;
  readonly cursor: string | null;
  readonly limit: number;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['cursor', 'expectedMembershipId', 'limit'])
    || !isCanonicalUuid(body.expectedMembershipId)
    || (body.cursor !== null && typeof body.cursor !== 'string')
    || (typeof body.cursor === 'string' && Buffer.byteLength(body.cursor, 'utf8') > 256)
    || !Number.isSafeInteger(body.limit)
    || (body.limit as number) < 1
    || (body.limit as number) > 20
  ) {
    return null;
  }
  return {
    expectedMembershipId: MembershipId(body.expectedMembershipId),
    cursor: body.cursor as string | null,
    limit: body.limit as number,
  };
}

function parseEmployeeEnrollmentRedemptionBody(body: unknown): {
  readonly commandId: string;
  readonly invitationSecret: string;
} | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['commandId', 'invitationSecret'])
    || !isCanonicalUuid(body.commandId)
    || typeof body.invitationSecret !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(body.invitationSecret)
  ) {
    return null;
  }
  const decoded = Buffer.from(body.invitationSecret, 'base64url');
  if (decoded.length !== 32 || decoded.toString('base64url') !== body.invitationSecret) {
    return null;
  }
  return { commandId: body.commandId, invitationSecret: body.invitationSecret };
}

function parseScanContextBody(body: unknown): {
  readonly requestedOrganizationId: OrganizationId;
  readonly payload: ReturnType<typeof createNfcPayload>;
} | null {
  if (!isRecord(body) || !hasExactKeys(body, ['organizationId', 'payload'])) {
    return null;
  }
  if (!isUuid(body.organizationId) || typeof body.payload !== 'string') {
    return null;
  }
  const payloadBytes = Buffer.byteLength(body.payload, 'utf8');
  if (payloadBytes === 0 || payloadBytes > MAX_SCAN_PAYLOAD_BYTES) {
    return null;
  }
  try {
    return {
      requestedOrganizationId: OrganizationId(body.organizationId),
      payload: createNfcPayload(body.payload),
    };
  } catch {
    return null;
  }
}

function parseLifecycleBody(
  accessToken: string,
  body: unknown,
  requiredAttemptNumber?: number,
): LifecycleIngestionCommand | null {
  if (
    !isRecord(body)
    || !hasExactKeys(body, ['organizationId', 'receipt', 'workEvent'])
    || !isUuid(body.organizationId)
    || !isRecord(body.workEvent)
    || !hasExactKeys(
      body.workEvent,
      ['assignmentId', 'id', 'nfcTagId', 'occurredAt', 'target'],
    )
    || !isUuid(body.workEvent.id)
    || !isUuid(body.workEvent.assignmentId)
    || !isUuid(body.workEvent.nfcTagId)
    || !isIsoTimestamp(body.workEvent.occurredAt)
    || !isRecord(body.workEvent.target)
    || !hasExactKeys(body.workEvent.target, ['targetId', 'targetType'])
    || body.workEvent.target.targetType !== 'customer'
    || !isUuid(body.workEvent.target.targetId)
    || !isRecord(body.receipt)
    || !hasExactKeys(body.receipt, ['attemptNumber', 'id'], ['clientTimeEntryId'])
    || !isUuid(body.receipt.id)
    || !Number.isSafeInteger(body.receipt.attemptNumber)
    || (body.receipt.attemptNumber as number) <= 0
    || (
      requiredAttemptNumber !== undefined
      && body.receipt.attemptNumber !== requiredAttemptNumber
    )
    || (
      body.receipt.clientTimeEntryId !== undefined
      && !isUuid(body.receipt.clientTimeEntryId)
    )
  ) {
    return null;
  }

  try {
    return {
      accessToken,
      requestedOrganizationId: OrganizationId(body.organizationId),
      workEvent: {
        id: WorkEventId(body.workEvent.id),
        assignmentId: NfcAssignmentId(body.workEvent.assignmentId),
        nfcTagId: NfcTagId(body.workEvent.nfcTagId),
        target: customerAssignmentTarget(CustomerId(body.workEvent.target.targetId)),
        occurredAt: createTimestamp(body.workEvent.occurredAt),
      },
      receipt: {
        id: body.receipt.id,
        attemptNumber: body.receipt.attemptNumber as number,
        ...(body.receipt.clientTimeEntryId === undefined
          ? {}
          : { clientTimeEntryId: TimeEntryId(body.receipt.clientTimeEntryId) }),
      },
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const actual = Object.keys(value).sort();
  if (actual.length < required.length || actual.length > required.length + optional.length) {
    return false;
  }
  return required.every((key) => Object.hasOwn(value, key))
    && actual.every((key) => required.includes(key) || optional.includes(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = isoTimestampPattern.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1]!;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validateTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Backend API operation timeout must be a positive safe integer');
  }
  return value;
}

async function withTimeout<Value>(operation: Promise<Value>, timeoutMilliseconds: number): Promise<Value> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Backend API dependency timed out')),
          timeoutMilliseconds,
        );
        timeout.unref();
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function emitDiagnostic(
  sink: BackendApiDiagnosticSink | undefined,
  diagnostic: BackendApiDiagnostic,
): void {
  try {
    sink?.(diagnostic);
  } catch {
    // Diagnostics are non-authoritative and cannot alter the disclosure-safe transport response.
  }
}

function applyResponseHeaders(response: ServerResponse, correlationId: string): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Request-Id', correlationId);
}

function respondError(response: ServerResponse, statusCode: number, code: ErrorCode): void {
  respondJson(response, statusCode, { error: { code } });
}

function respondJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (response.writableEnded || response.destroyed) {
    return;
  }
  response.statusCode = statusCode;
  response.end(JSON.stringify(body));
}

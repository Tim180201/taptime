import {
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS,
  OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
  OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
  isCanonicalOfflineUuid,
  isLowercaseSha256Hex,
  isOfflineAsciiCursor,
  isOfflineBase64Url32Bytes,
  isOfflineIsoTimestamp,
  isPositiveSafeInteger,
  type OfflineCaptureLeaseHeader,
  type OfflineCaptureLeaseIssueCommand,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeasePage,
  type OfflineCaptureLeasePageCommand,
  type OfflineCaptureLeaseResult,
  type OfflineCaptureLeaseItemV2,
  type OfflineCaptureLeasePageV2,
  type OfflineCaptureLeaseResultV2,
  type OfflineCaptureLeaseItemV3,
  type OfflineCaptureLeasePageV3,
  type OfflineCaptureLeaseResultV3,
} from '@taptime/offline-sync-contract';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../transport/AuthenticatedHttpRequestExecutor';
import {
  hasExactKeys,
  isJsonContentType,
  isObject,
  parseJsonObject,
  utf8ByteLength,
} from '../transport/strictJson';
import { mobileManifestDigest, mobileManifestDigestV2, mobileManifestDigestV3 } from './MobileLookupHmac';

const ISSUE_PATH = '/v1/offline-capture-leases';
const PAGE_PATH = '/v1/offline-capture-leases/page';
const ISSUE_V2_PATH = '/v2/offline-capture-leases';
const PAGE_V2_PATH = '/v2/offline-capture-leases/page';
const ISSUE_V3_PATH = '/v3/offline-capture-leases';
const PAGE_V3_PATH = '/v3/offline-capture-leases/page';

export interface OfflineCaptureLeaseApiPort {
  issueComplete(command: OfflineCaptureLeaseIssueCommand): Promise<OfflineCaptureLeaseResult>;
  readonly issueCompleteV2?: (
    command: OfflineCaptureLeaseIssueCommand,
  ) => Promise<OfflineCaptureLeaseResultV2>;
  readonly issueCompleteV3?: (
    command: OfflineCaptureLeaseIssueCommand,
  ) => Promise<OfflineCaptureLeaseResultV3>;
}

export class OfflineCaptureLeaseClient implements OfflineCaptureLeaseApiPort {
  private readonly issueEndpoint: URL;
  private readonly pageEndpoint: URL;
  private readonly issueV2Endpoint: URL;
  private readonly pageV2Endpoint: URL;
  private readonly issueV3Endpoint: URL;
  private readonly pageV3Endpoint: URL;

  constructor(
    apiBaseUrl: URL,
    private readonly requests: AuthenticatedJsonPostPort,
  ) {
    this.issueEndpoint = new URL(ISSUE_PATH, apiBaseUrl);
    this.pageEndpoint = new URL(PAGE_PATH, apiBaseUrl);
    this.issueV2Endpoint = new URL(ISSUE_V2_PATH, apiBaseUrl);
    this.pageV2Endpoint = new URL(PAGE_V2_PATH, apiBaseUrl);
    this.issueV3Endpoint = new URL(ISSUE_V3_PATH, apiBaseUrl);
    this.pageV3Endpoint = new URL(PAGE_V3_PATH, apiBaseUrl);
  }

  async issueCompleteV3(
    command: OfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResultV3> {
    if (!validIssueCommand(command)) return { status: 'unavailable' };
    const first = await this.postLeaseV3(this.issueV3Endpoint, command);
    if (first.status !== 'ready') return first;
    const header = leaseHeaderV3(first.page);
    const items = [...first.page.items];
    let cursor = first.page.nextCursor;
    let lastItemId = items.at(-1)?.itemId ?? null;
    const itemIds = new Set(items.map(({ itemId }) => itemId));
    const lookups = new Set(items.flatMap((item) => item.itemType === 'nfc_assignment'
      ? [item.lookup] : []));
    const manualTargets = new Set(items.flatMap((item) => item.itemType === 'manual_target'
      ? [`${item.targetType}:${item.targetId}`] : []));
    let manualBreakSeen = items.some((item) => item.itemType === 'manual_break');
    const seenCursors = new Set<string>();
    let pageResponses = 1;
    const maximumPageResponses = Math.ceil(
      OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS / OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
    );
    while (cursor !== null) {
      if (!isOfflineAsciiCursor(cursor) || seenCursors.has(cursor)
        || pageResponses >= maximumPageResponses
        || items.length >= OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS) {
        return { status: 'incomplete_or_oversize' };
      }
      seenCursors.add(cursor);
      const next = await this.postLeaseV3(this.pageV3Endpoint, {
        leaseId: header.leaseId, cursor, limit: OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
      });
      pageResponses += 1;
      if (next.status !== 'ready') return next;
      if (!sameLeaseHeaderV3(header, next.page)) return { status: 'incomplete_or_oversize' };
      for (const item of next.page.items) {
        const manualKey = item.itemType === 'manual_target'
          ? `${item.targetType}:${item.targetId}` : null;
        if (itemIds.has(item.itemId)
          || (item.itemType === 'nfc_assignment' && lookups.has(item.lookup))
          || (manualKey !== null && manualTargets.has(manualKey))
          || (item.itemType === 'manual_break' && manualBreakSeen)
          || (lastItemId !== null && item.itemId.localeCompare(lastItemId, 'en') <= 0)) {
          return { status: 'incomplete_or_oversize' };
        }
        items.push(item); itemIds.add(item.itemId);
        if (item.itemType === 'nfc_assignment') lookups.add(item.lookup);
        if (manualKey !== null) manualTargets.add(manualKey);
        if (item.itemType === 'manual_break') manualBreakSeen = true;
        lastItemId = item.itemId;
      }
      if (next.page.nextCursor === cursor) return { status: 'incomplete_or_oversize' };
      cursor = next.page.nextCursor;
    }
    const serializedBytes = utf8ByteLength(JSON.stringify(items));
    if (items.length !== header.itemCount || serializedBytes !== header.serializedBytes
      || serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
      || mobileManifestDigestV3(items) !== header.manifestDigest) {
      return { status: 'incomplete_or_oversize' };
    }
    return { status: 'ready', idempotentRetry: first.idempotentRetry,
      page: Object.freeze({ ...header, items: Object.freeze(items), nextCursor: null }) };
  }

  async issueCompleteV2(
    command: OfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResultV2> {
    if (!validIssueCommand(command)) return { status: 'unavailable' };
    const first = await this.postLeaseV2(this.issueV2Endpoint, command);
    if (first.status !== 'ready') return first;
    const header = leaseHeaderV2(first.page);
    const items = [...first.page.items];
    let cursor = first.page.nextCursor;
    let lastItemId = items.at(-1)?.itemId ?? null;
    const itemIds = new Set(items.map(({ itemId }) => itemId));
    const lookups = new Set(
      items.flatMap((item) => item.itemType === 'nfc_assignment' ? [item.lookup] : []),
    );
    const manualTargets = new Set(
      items.flatMap((item) => item.itemType === 'manual_target'
        ? [`${item.targetType}:${item.targetId}`]
        : []),
    );
    const seenCursors = new Set<string>();
    let pageResponses = 1;
    const maximumPageResponses = Math.ceil(
      OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS / OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
    );
    while (cursor !== null) {
      if (
        !isOfflineAsciiCursor(cursor)
        || seenCursors.has(cursor)
        || pageResponses >= maximumPageResponses
        || items.length >= OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
      ) return { status: 'incomplete_or_oversize' };
      seenCursors.add(cursor);
      const next = await this.postLeaseV2(this.pageV2Endpoint, {
        leaseId: header.leaseId,
        cursor,
        limit: OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
      });
      pageResponses += 1;
      if (next.status !== 'ready') return next;
      if (!sameLeaseHeaderV2(header, next.page)) {
        return { status: 'incomplete_or_oversize' };
      }
      for (const item of next.page.items) {
        const manualKey = `${item.targetType}:${item.targetId}`;
        if (
          itemIds.has(item.itemId)
          || (item.itemType === 'nfc_assignment' && lookups.has(item.lookup))
          || (item.itemType === 'manual_target' && manualTargets.has(manualKey))
          || (lastItemId !== null && item.itemId.localeCompare(lastItemId, 'en') <= 0)
        ) return { status: 'incomplete_or_oversize' };
        items.push(item);
        itemIds.add(item.itemId);
        if (item.itemType === 'nfc_assignment') lookups.add(item.lookup);
        else manualTargets.add(manualKey);
        lastItemId = item.itemId;
      }
      if (next.page.nextCursor === cursor) {
        return { status: 'incomplete_or_oversize' };
      }
      cursor = next.page.nextCursor;
    }
    const serializedBytes = utf8ByteLength(JSON.stringify(items));
    if (
      items.length !== header.itemCount
      || serializedBytes !== header.serializedBytes
      || serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
      || mobileManifestDigestV2(items) !== header.manifestDigest
    ) return { status: 'incomplete_or_oversize' };
    return {
      status: 'ready',
      idempotentRetry: first.idempotentRetry,
      page: Object.freeze({ ...header, items: Object.freeze(items), nextCursor: null }),
    };
  }

  async issueComplete(
    command: OfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResult> {
    if (!validIssueCommand(command)) return { status: 'unavailable' };
    const first = await this.postLease(this.issueEndpoint, command);
    if (first.status !== 'ready') return first;

    const header = leaseHeader(first.page);
    const items = [...first.page.items];
    let cursor = first.page.nextCursor;
    let lastItemId = items.at(-1)?.itemId ?? null;
    const itemIds = new Set(items.map(({ itemId }) => itemId));
    const lookups = new Set(items.map(({ lookup }) => lookup));
    const seenCursors = new Set<string>();
    let pageResponses = 1;
    const maximumPageResponses = Math.ceil(
      OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS / OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
    );

    while (cursor !== null) {
      if (
        !isOfflineAsciiCursor(cursor)
        || seenCursors.has(cursor)
        || pageResponses >= maximumPageResponses
        || items.length >= OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
      ) {
        return { status: 'incomplete_or_oversize' };
      }
      seenCursors.add(cursor);
      const next = await this.postLease(this.pageEndpoint, {
        leaseId: header.leaseId,
        cursor,
        limit: OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
      } satisfies OfflineCaptureLeasePageCommand);
      pageResponses += 1;
      if (next.status !== 'ready') return next;
      if (!sameLeaseHeader(header, next.page)) {
        return { status: 'incomplete_or_oversize' };
      }
      for (const item of next.page.items) {
        if (
          itemIds.has(item.itemId)
          || lookups.has(item.lookup)
          || (lastItemId !== null && item.itemId.localeCompare(lastItemId, 'en') <= 0)
        ) {
          return { status: 'incomplete_or_oversize' };
        }
        items.push(item);
        itemIds.add(item.itemId);
        lookups.add(item.lookup);
        lastItemId = item.itemId;
        if (items.length > OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS) {
          return { status: 'incomplete_or_oversize' };
        }
      }
      if (next.page.nextCursor === cursor) {
        return { status: 'incomplete_or_oversize' };
      }
      cursor = next.page.nextCursor;
    }

    const serializedBytes = utf8ByteLength(JSON.stringify(items));
    if (
      items.length !== header.itemCount
      || serializedBytes !== header.serializedBytes
      || serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
      || mobileManifestDigest(items) !== header.manifestDigest
    ) {
      return { status: 'incomplete_or_oversize' };
    }
    return {
      status: 'ready',
      idempotentRetry: first.idempotentRetry,
      page: Object.freeze({
        ...header,
        items: Object.freeze(items),
        nextCursor: null,
      }),
    };
  }

  private async postLease(
    endpoint: URL,
    body: OfflineCaptureLeaseIssueCommand | OfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResult> {
    let response: AuthenticatedHttpResult;
    try {
      response = await this.requests.post(endpoint, JSON.stringify(body), {
        maximumResponseBytes: OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
      });
    } catch {
      return { status: 'unavailable' };
    }
    if (response.status === 'authority_rejected') return response;
    if (response.status !== 'response') return { status: 'unavailable' };
    if (!isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const parsed = parseLeaseResult(response.body);
    if (parsed === null) return { status: 'unavailable' };
    if (response.statusCode === 200 && parsed.status === 'ready') return parsed;
    if (response.statusCode === 409 && parsed.status === 'incomplete_or_oversize') return parsed;
    return { status: 'unavailable' };
  }

  private async postLeaseV2(
    endpoint: URL,
    body: OfflineCaptureLeaseIssueCommand | OfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResultV2> {
    let response: AuthenticatedHttpResult;
    try {
      response = await this.requests.post(endpoint, JSON.stringify(body), {
        maximumResponseBytes: OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
      });
    } catch {
      return { status: 'unavailable' };
    }
    if (response.status === 'authority_rejected') return response;
    if (response.status !== 'response' || !isJsonContentType(response.contentType)) {
      return { status: 'unavailable' };
    }
    const parsed = parseLeaseResultV2(response.body);
    if (parsed === null) return { status: 'unavailable' };
    if (response.statusCode === 200 && parsed.status === 'ready') return parsed;
    if (response.statusCode === 409 && parsed.status === 'incomplete_or_oversize') return parsed;
    return { status: 'unavailable' };
  }

  private async postLeaseV3(
    endpoint: URL,
    body: OfflineCaptureLeaseIssueCommand | OfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResultV3> {
    let response: AuthenticatedHttpResult;
    try {
      response = await this.requests.post(endpoint, JSON.stringify(body), {
        maximumResponseBytes: OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
      });
    } catch { return { status: 'unavailable' }; }
    if (response.status === 'authority_rejected') return response;
    if (response.status !== 'response' || !isJsonContentType(response.contentType)) {
      return { status: 'unavailable' };
    }
    const parsed = parseLeaseResultV3(response.body);
    if (parsed === null) return { status: 'unavailable' };
    if (response.statusCode === 200 && parsed.status === 'ready') return parsed;
    if (response.statusCode === 409 && parsed.status === 'incomplete_or_oversize') return parsed;
    return { status: 'unavailable' };
  }
}

function parseLeaseResult(body: string): OfflineCaptureLeaseResult | null {
  const value = parseJsonObject(body);
  if (value === null || typeof value.status !== 'string') return null;
  if (
    value.status === 'incomplete_or_oversize'
    && hasExactKeys(value, ['status'])
  ) {
    return { status: 'incomplete_or_oversize' };
  }
  if (
    value.status !== 'ready'
    || !hasExactKeys(value, ['idempotentRetry', 'page', 'status'])
    || typeof value.idempotentRetry !== 'boolean'
  ) return null;
  const page = parseLeasePage(value.page);
  return page === null
    ? null
    : {
        status: 'ready',
        idempotentRetry: value.idempotentRetry,
        page,
      };
}

function parseLeaseResultV2(body: string): OfflineCaptureLeaseResultV2 | null {
  const value = parseJsonObject(body);
  if (value === null || typeof value.status !== 'string') return null;
  if (value.status === 'incomplete_or_oversize' && hasExactKeys(value, ['status'])) {
    return { status: 'incomplete_or_oversize' };
  }
  if (
    value.status !== 'ready'
    || !hasExactKeys(value, ['idempotentRetry', 'page', 'status'])
    || typeof value.idempotentRetry !== 'boolean'
  ) return null;
  const page = parseLeasePageV2(value.page);
  return page === null ? null : {
    status: 'ready',
    idempotentRetry: value.idempotentRetry,
    page,
  };
}

function parseLeaseResultV3(body: string): OfflineCaptureLeaseResultV3 | null {
  const value = parseJsonObject(body);
  if (value === null || typeof value.status !== 'string') return null;
  if (value.status === 'incomplete_or_oversize' && hasExactKeys(value, ['status'])) {
    return { status: 'incomplete_or_oversize' };
  }
  if (value.status !== 'ready'
    || !hasExactKeys(value, ['idempotentRetry', 'page', 'status'])
    || typeof value.idempotentRetry !== 'boolean') return null;
  const page = parseLeasePageV3(value.page);
  return page === null ? null : { status: 'ready', idempotentRetry: value.idempotentRetry, page };
}

function parseLeasePage(value: unknown): OfflineCaptureLeasePage | null {
  if (
    !isObject(value)
    || !hasExactKeys(value, [
      'configurationRevision',
      'expiresAt',
      'identityBindingId',
      'installationId',
      'issuedAt',
      'itemCount',
      'items',
      'leaseId',
      'manifestDigest',
      'membershipId',
      'membershipRowVersion',
      'nextCursor',
      'organizationId',
      'role',
      'serializedBytes',
      'userId',
    ])
    || !validLeaseHeader(value)
    || !Array.isArray(value.items)
    || value.items.length > OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS
    || (value.nextCursor !== null && !isOfflineAsciiCursor(value.nextCursor))
  ) return null;
  const items: OfflineCaptureLeaseItem[] = [];
  let previous: string | null = null;
  const lookups = new Set<string>();
  for (const candidate of value.items) {
    const item = parseLeaseItem(candidate);
    if (
      item === null
      || lookups.has(item.lookup)
      || (previous !== null && item.itemId.localeCompare(previous, 'en') <= 0)
    ) return null;
    items.push(item);
    previous = item.itemId;
    lookups.add(item.lookup);
  }
  return Object.freeze({
    ...leaseHeader(value as unknown as OfflineCaptureLeasePage),
    items: Object.freeze(items),
    nextCursor: value.nextCursor as string | null,
  });
}

function parseLeasePageV2(value: unknown): OfflineCaptureLeasePageV2 | null {
  if (
    !isObject(value)
    || !hasExactKeys(value, [
      'configurationRevision', 'expiresAt', 'identityBindingId', 'installationId',
      'issuedAt', 'itemCount', 'items', 'leaseId', 'leaseSchemaVersion',
      'manifestDigest', 'manifestVersion', 'membershipId', 'membershipRowVersion',
      'nextCursor', 'organizationId', 'role', 'serializedBytes', 'userId',
    ])
    || value.leaseSchemaVersion !== 2
    || value.manifestVersion !== 2
    || !validLeaseHeader(value)
    || !Array.isArray(value.items)
    || value.items.length > OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS
    || (value.nextCursor !== null && !isOfflineAsciiCursor(value.nextCursor))
  ) return null;
  const items: OfflineCaptureLeaseItemV2[] = [];
  let previous: string | null = null;
  const lookups = new Set<string>();
  const manualTargets = new Set<string>();
  for (const candidate of value.items) {
    const item = parseLeaseItemV2(candidate);
    if (item === null || (previous !== null && item.itemId.localeCompare(previous, 'en') <= 0)) {
      return null;
    }
    if (item.itemType === 'nfc_assignment') {
      if (lookups.has(item.lookup)) return null;
      lookups.add(item.lookup);
    } else {
      const key = `${item.targetType}:${item.targetId}`;
      if (manualTargets.has(key)) return null;
      manualTargets.add(key);
    }
    items.push(item);
    previous = item.itemId;
  }
  return Object.freeze({
    ...(leaseHeaderV2(value as unknown as OfflineCaptureLeasePageV2)),
    items: Object.freeze(items),
    nextCursor: value.nextCursor as string | null,
  });
}

function parseLeasePageV3(value: unknown): OfflineCaptureLeasePageV3 | null {
  if (!isObject(value) || !hasExactKeys(value, [
    'configurationRevision', 'expiresAt', 'identityBindingId', 'installationId',
    'issuedAt', 'itemCount', 'items', 'leaseId', 'leaseSchemaVersion',
    'manifestDigest', 'manifestVersion', 'membershipId', 'membershipRowVersion',
    'nextCursor', 'organizationId', 'role', 'serializedBytes', 'userId',
  ]) || value.leaseSchemaVersion !== 3 || value.manifestVersion !== 3
    || !validLeaseHeader(value) || !Array.isArray(value.items)
    || value.items.length > OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS
    || (value.nextCursor !== null && !isOfflineAsciiCursor(value.nextCursor))) return null;
  const items: OfflineCaptureLeaseItemV3[] = [];
  let previous: string | null = null;
  const lookups = new Set<string>();
  const manualTargets = new Set<string>();
  let manualBreakSeen = false;
  for (const candidate of value.items) {
    const item = parseLeaseItemV3(candidate);
    if (item === null || (previous !== null && item.itemId.localeCompare(previous, 'en') <= 0)) {
      return null;
    }
    if (item.itemType === 'nfc_assignment') {
      if (lookups.has(item.lookup)) return null;
      lookups.add(item.lookup);
    } else if (item.itemType === 'manual_target') {
      const key = `${item.targetType}:${item.targetId}`;
      if (manualTargets.has(key)) return null;
      manualTargets.add(key);
    } else if (manualBreakSeen) return null;
    else manualBreakSeen = true;
    items.push(item); previous = item.itemId;
  }
  return Object.freeze({ ...leaseHeaderV3(value as unknown as OfflineCaptureLeasePageV3),
    items: Object.freeze(items), nextCursor: value.nextCursor as string | null });
}

function validLeaseHeader(value: Record<string, unknown>): boolean {
  return [
    value.leaseId,
    value.installationId,
    value.identityBindingId,
    value.userId,
    value.organizationId,
    value.membershipId,
  ].every(isCanonicalOfflineUuid)
    && isPositiveSafeInteger(value.membershipRowVersion)
    && (value.role === 'administrator' || value.role === 'employee')
    && isOfflineIsoTimestamp(value.issuedAt)
    && isOfflineIsoTimestamp(value.expiresAt)
    && isLowercaseSha256Hex(value.configurationRevision)
    && Number.isSafeInteger(value.itemCount)
    && Number(value.itemCount) >= 0
    && Number(value.itemCount) <= OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
    && Number.isSafeInteger(value.serializedBytes)
    && Number(value.serializedBytes) >= 0
    && Number(value.serializedBytes) <= OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
    && isLowercaseSha256Hex(value.manifestDigest);
}

function parseLeaseItem(value: unknown): OfflineCaptureLeaseItem | null {
  if (
    !isObject(value)
    || !hasExactKeys(value, [
      'assignmentId',
      'displayName',
      'itemId',
      'lookup',
      'nfcTagId',
      'targetId',
      'targetType',
    ])
    || !isCanonicalOfflineUuid(value.itemId)
    || !isLowercaseSha256Hex(value.lookup)
    || !isCanonicalOfflineUuid(value.assignmentId)
    || !isCanonicalOfflineUuid(value.nfcTagId)
    || value.targetType !== 'customer'
    || !isCanonicalOfflineUuid(value.targetId)
    || typeof value.displayName !== 'string'
    || value.displayName.length === 0
    || utf8ByteLength(value.displayName) > 1_024
  ) return null;
  return Object.freeze({
    itemId: value.itemId,
    lookup: value.lookup,
    assignmentId: value.assignmentId,
    nfcTagId: value.nfcTagId,
    targetType: value.targetType,
    targetId: value.targetId,
    displayName: value.displayName,
  });
}

function parseLeaseItemV2(value: unknown): OfflineCaptureLeaseItemV2 | null {
  if (
    !isObject(value)
    || !isCanonicalOfflineUuid(value.itemId)
    || !isCanonicalOfflineUuid(value.targetId)
    || typeof value.displayName !== 'string'
    || value.displayName.length === 0
    || utf8ByteLength(value.displayName) > 480
    || !isPositiveSafeInteger(value.targetRowVersion)
  ) return null;
  if (value.itemType === 'manual_target') {
    if (
      !hasExactKeys(value, [
        'displayName', 'itemId', 'itemType', 'targetId', 'targetRowVersion', 'targetType',
      ])
      || (
        value.targetType !== 'customer'
        && value.targetType !== 'project'
        && value.targetType !== 'general_work'
      )
    ) return null;
    return Object.freeze({
      itemType: 'manual_target',
      itemId: value.itemId,
      targetType: value.targetType,
      targetId: value.targetId,
      displayName: value.displayName,
      targetRowVersion: value.targetRowVersion,
    });
  }
  if (
    value.itemType !== 'nfc_assignment'
    || !hasExactKeys(value, [
      'assignmentId', 'assignmentRowVersion', 'displayName', 'itemId', 'itemType',
      'lookup', 'nfcTagId', 'targetId', 'targetRowVersion', 'targetType',
    ])
    || !isLowercaseSha256Hex(value.lookup)
    || !isCanonicalOfflineUuid(value.assignmentId)
    || !isCanonicalOfflineUuid(value.nfcTagId)
    || value.targetType !== 'customer'
    || !isPositiveSafeInteger(value.assignmentRowVersion)
  ) return null;
  return Object.freeze({
    itemType: 'nfc_assignment',
    itemId: value.itemId,
    lookup: value.lookup,
    assignmentId: value.assignmentId,
    nfcTagId: value.nfcTagId,
    targetType: 'customer',
    targetId: value.targetId,
    displayName: value.displayName,
    assignmentRowVersion: value.assignmentRowVersion,
    targetRowVersion: value.targetRowVersion,
  });
}

function parseLeaseItemV3(value: unknown): OfflineCaptureLeaseItemV3 | null {
  if (!isObject(value) || !isCanonicalOfflineUuid(value.itemId)
    || typeof value.displayName !== 'string' || value.displayName.length === 0
    || utf8ByteLength(value.displayName) > 480) return null;
  if (value.itemType === 'manual_break') {
    return hasExactKeys(value, ['displayName', 'itemId', 'itemType', 'subjectType'])
      && value.subjectType === 'break' && value.displayName === 'Pause'
      ? Object.freeze({ itemType: 'manual_break', subjectType: 'break', itemId: value.itemId,
          displayName: 'Pause' }) : null;
  }
  if (value.itemType === 'manual_target') {
    if (!hasExactKeys(value, ['displayName', 'itemId', 'itemType', 'subjectType',
      'targetId', 'targetRowVersion', 'targetType']) || value.subjectType !== 'work'
      || !isCanonicalOfflineUuid(value.targetId) || !isPositiveSafeInteger(value.targetRowVersion)
      || !['customer', 'project', 'general_work'].includes(String(value.targetType))) return null;
    return Object.freeze({ itemType: 'manual_target', subjectType: 'work', itemId: value.itemId,
      targetType: value.targetType as 'customer' | 'project' | 'general_work',
      targetId: value.targetId, displayName: value.displayName,
      targetRowVersion: value.targetRowVersion });
  }
  if (value.itemType !== 'nfc_assignment' || !isLowercaseSha256Hex(value.lookup)
    || !isCanonicalOfflineUuid(value.assignmentId) || !isCanonicalOfflineUuid(value.nfcTagId)
    || !isPositiveSafeInteger(value.assignmentRowVersion)) return null;
  if (value.subjectType === 'break') {
    return hasExactKeys(value, ['assignmentId', 'assignmentRowVersion', 'displayName',
      'itemId', 'itemType', 'lookup', 'nfcTagId', 'subjectType'])
      && value.displayName === 'Pause'
      ? Object.freeze({ itemType: 'nfc_assignment', subjectType: 'break', itemId: value.itemId,
          lookup: value.lookup, assignmentId: value.assignmentId, nfcTagId: value.nfcTagId,
          displayName: 'Pause', assignmentRowVersion: value.assignmentRowVersion }) : null;
  }
  if (!hasExactKeys(value, ['assignmentId', 'assignmentRowVersion', 'displayName', 'itemId',
    'itemType', 'lookup', 'nfcTagId', 'subjectType', 'targetId', 'targetRowVersion',
    'targetType']) || value.subjectType !== 'work' || value.targetType !== 'customer'
    || !isCanonicalOfflineUuid(value.targetId) || !isPositiveSafeInteger(value.targetRowVersion)) {
    return null;
  }
  return Object.freeze({ itemType: 'nfc_assignment', subjectType: 'work', itemId: value.itemId,
    lookup: value.lookup, assignmentId: value.assignmentId, nfcTagId: value.nfcTagId,
    targetType: 'customer', targetId: value.targetId, displayName: value.displayName,
    assignmentRowVersion: value.assignmentRowVersion, targetRowVersion: value.targetRowVersion });
}

function validIssueCommand(command: OfflineCaptureLeaseIssueCommand): boolean {
  return isCanonicalOfflineUuid(command.commandId)
    && isOfflineBase64Url32Bytes(command.installationBinding)
    && isOfflineBase64Url32Bytes(command.lookupKey);
}

function leaseHeader(page: OfflineCaptureLeasePage): OfflineCaptureLeaseHeader {
  return Object.freeze({
    leaseId: page.leaseId,
    installationId: page.installationId,
    identityBindingId: page.identityBindingId,
    userId: page.userId,
    organizationId: page.organizationId,
    membershipId: page.membershipId,
    membershipRowVersion: page.membershipRowVersion,
    role: page.role,
    issuedAt: page.issuedAt,
    expiresAt: page.expiresAt,
    configurationRevision: page.configurationRevision,
    itemCount: page.itemCount,
    serializedBytes: page.serializedBytes,
    manifestDigest: page.manifestDigest,
  });
}

function sameLeaseHeader(
  expected: OfflineCaptureLeaseHeader,
  actual: OfflineCaptureLeasePage,
): boolean {
  const candidate = leaseHeader(actual);
  return (Object.keys(expected) as (keyof OfflineCaptureLeaseHeader)[])
    .every((key) => candidate[key] === expected[key]);
}

type OfflineCaptureLeaseHeaderV2 = Omit<OfflineCaptureLeasePageV2, 'items' | 'nextCursor'>;

function leaseHeaderV2(page: OfflineCaptureLeasePageV2): OfflineCaptureLeaseHeaderV2 {
  const { items: _items, nextCursor: _nextCursor, ...header } = page;
  return Object.freeze(header);
}

function sameLeaseHeaderV2(
  expected: OfflineCaptureLeaseHeaderV2,
  actual: OfflineCaptureLeasePageV2,
): boolean {
  const candidate = leaseHeaderV2(actual);
  return (Object.keys(expected) as (keyof OfflineCaptureLeaseHeaderV2)[])
    .every((key) => candidate[key] === expected[key]);
}

type OfflineCaptureLeaseHeaderV3 = Omit<OfflineCaptureLeasePageV3, 'items' | 'nextCursor'>;

function leaseHeaderV3(page: OfflineCaptureLeasePageV3): OfflineCaptureLeaseHeaderV3 {
  const { items: _items, nextCursor: _nextCursor, ...header } = page;
  return Object.freeze(header);
}

function sameLeaseHeaderV3(
  expected: OfflineCaptureLeaseHeaderV3,
  actual: OfflineCaptureLeasePageV3,
): boolean {
  const candidate = leaseHeaderV3(actual);
  return (Object.keys(expected) as (keyof OfflineCaptureLeaseHeaderV3)[])
    .every((key) => candidate[key] === expected[key]);
}

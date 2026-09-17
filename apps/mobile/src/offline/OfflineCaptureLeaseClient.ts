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
  type OfflineCaptureLeaseIssueCommand,
  type OfflineCaptureLeasePageCommand,
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
import { mobileManifestDigestV3 } from './MobileLookupHmac';

const ISSUE_V3_PATH = '/v3/offline-capture-leases';
const PAGE_V3_PATH = '/v3/offline-capture-leases/page';

export interface OfflineCaptureLeaseApiPort {
  readonly issueCompleteV3?: (
    command: OfflineCaptureLeaseIssueCommand,
  ) => Promise<OfflineCaptureLeaseResultV3>;
}

export class OfflineCaptureLeaseClient implements OfflineCaptureLeaseApiPort {
  private readonly issueV3Endpoint: URL;
  private readonly pageV3Endpoint: URL;

  constructor(
    apiBaseUrl: URL,
    private readonly requests: AuthenticatedJsonPostPort,
  ) {
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

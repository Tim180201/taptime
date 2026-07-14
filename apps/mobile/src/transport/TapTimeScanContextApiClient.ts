import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  customerAssignmentTarget,
} from '@taptime/core';
import type { AuthenticatedJsonPostPort } from './AuthenticatedHttpRequestExecutor';
import type {
  ScanContextApiPort,
  ScanContextResolutionCommand,
  ScanContextResolutionResult,
} from './contracts';
import {
  hasExactKeys,
  isJsonContentType,
  isObject,
  isUuid,
  parseJsonObject,
  utf8ByteLength,
} from './strictJson';

const MAXIMUM_PAYLOAD_BYTES = 1024;

export class TapTimeScanContextApiClient implements ScanContextApiPort {
  private readonly endpoint: URL;

  constructor(baseUrl: string, private readonly request: AuthenticatedJsonPostPort) {
    this.endpoint = new URL('v1/scan-context/resolve', withTrailingSlash(baseUrl));
  }

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolutionResult> {
    if (
      !isUuid(command.organizationId)
      || command.payload.length === 0
      || utf8ByteLength(command.payload) > MAXIMUM_PAYLOAD_BYTES
    ) {
      return { status: 'unavailable' };
    }
    const response = await this.request.post(this.endpoint, JSON.stringify({
      organizationId: command.organizationId,
      payload: command.payload,
    }));
    if (response.status !== 'response') {
      return response;
    }
    if (response.statusCode === 404) {
      const error = parseJsonObject(response.body);
      if (
        !isJsonContentType(response.contentType)
        || error === null
        || !hasExactKeys(error, ['error'])
        || !isObject(error.error)
        || !hasExactKeys(error.error, ['code'])
        || error.error.code !== 'not_found'
      ) {
        return { status: 'unavailable' };
      }
      return { status: 'not_resolved' };
    }
    if (
      response.statusCode !== 200
      || !isJsonContentType(response.contentType)
    ) {
      return { status: 'unavailable' };
    }

    const body = parseJsonObject(response.body);
    if (
      body === null
      || !hasExactKeys(body, ['assignmentId', 'nfcTagId', 'target'])
      || !isUuid(body.assignmentId)
      || !isUuid(body.nfcTagId)
      || !isObject(body.target)
      || !hasExactKeys(body.target, ['targetId', 'targetType'])
      || body.target.targetType !== 'customer'
      || !isUuid(body.target.targetId)
    ) {
      return { status: 'unavailable' };
    }
    return {
      status: 'resolved',
      assignmentId: NfcAssignmentId(body.assignmentId),
      nfcTagId: NfcTagId(body.nfcTagId),
      target: customerAssignmentTarget(CustomerId(body.target.targetId)),
    };
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

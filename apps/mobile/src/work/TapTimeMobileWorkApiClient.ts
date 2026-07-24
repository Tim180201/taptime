import {
  validateOwnTimeResponse,
  validateWorkTargetResponse,
  type SafeWorkTarget,
} from '@taptime/mobile-work-contract';
import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import type {
  ManualTriggerResult,
  MobileOwnTimePageResult,
  MobileWorkApiPort,
  MobileWorkReadResult,
} from './contracts';

export class TapTimeMobileWorkApiClient implements MobileWorkApiPort {
  constructor(
    private readonly baseUrl: URL,
    private readonly requests: AuthenticatedJsonPostPort,
    private readonly createUuid: () => string,
  ) {}

  async read(expectedMembershipId: string): Promise<MobileWorkReadResult> {
    const body = JSON.stringify({
      expectedMembershipId,
      cursor: null,
      limit: 20,
    });
    const [ownTime, targets] = await Promise.all([
      this.requests.post(new URL('/v1/mobile/own-time/query', this.baseUrl), body),
      this.requests.post(new URL('/v1/mobile/work-targets/query', this.baseUrl), JSON.stringify({
        expectedMembershipId,
        cursor: null,
        limit: 50,
      })),
    ]);
    if (ownTime.status === 'authority_rejected' || targets.status === 'authority_rejected') {
      return { status: 'authority_rejected' };
    }
    if (
      ownTime.status !== 'response'
      || ownTime.statusCode !== 200
      || !isJson(ownTime.contentType)
      || targets.status !== 'response'
      || targets.statusCode !== 200
      || !isJson(targets.contentType)
    ) return { status: 'unavailable' };
    try {
      const ownTimeValue: unknown = JSON.parse(ownTime.body);
      const targetsValue: unknown = JSON.parse(targets.body);
      if (!validateOwnTimeResponse(ownTimeValue)
        || !validateWorkTargetResponse(targetsValue)) {
        return { status: 'unavailable' };
      }
      const allTargets = [...targetsValue.targets];
      const identities = new Set(allTargets.map((target) => (
        `${target.targetType}\u001f${target.targetId}`
      )));
      let cursor = targetsValue.nextCursor;
      const cursors = new Set<string>();
      for (let page = 1; cursor !== null && page < 82; page += 1) {
        if (cursors.has(cursor)) return { status: 'unavailable' };
        cursors.add(cursor);
        const next = await this.requests.post(
          new URL('/v1/mobile/work-targets/query', this.baseUrl),
          JSON.stringify({ expectedMembershipId, cursor, limit: 50 }),
        );
        if (next.status === 'authority_rejected') return next;
        if (
          next.status !== 'response'
          || next.statusCode !== 200
          || !isJson(next.contentType)
        ) return { status: 'unavailable' };
        const value: unknown = JSON.parse(next.body);
        if (!validateWorkTargetResponse(value)) return { status: 'unavailable' };
        for (const target of value.targets) {
          const identity = `${target.targetType}\u001f${target.targetId}`;
          if (identities.has(identity)) return { status: 'unavailable' };
          identities.add(identity);
          allTargets.push(target);
        }
        cursor = value.nextCursor;
      }
      if (cursor !== null) return { status: 'unavailable' };
      return {
        status: 'ready',
        ownTime: ownTimeValue,
        targets: { targets: Object.freeze(allTargets), nextCursor: null },
      };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async readOwnTimePage(
    expectedMembershipId: string,
    cursor: string,
  ): Promise<MobileOwnTimePageResult> {
    const response = await this.requests.post(
      new URL('/v1/mobile/own-time/query', this.baseUrl),
      JSON.stringify({ expectedMembershipId, cursor, limit: 20 }),
    );
    if (response.status === 'authority_rejected') return response;
    if (
      response.status !== 'response'
      || response.statusCode !== 200
      || !isJson(response.contentType)
    ) return { status: 'unavailable' };
    try {
      const value: unknown = JSON.parse(response.body);
      return validateOwnTimeResponse(value)
        ? { status: 'ready', ownTime: value }
        : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async triggerManual(
    expectedMembershipId: string,
    target: SafeWorkTarget,
  ): Promise<ManualTriggerResult> {
    const response = await this.requests.post(
      new URL('/v1/lifecycle-events/manual', this.baseUrl),
      JSON.stringify({
        expectedMembershipId,
        workEvent: {
          id: this.createUuid(),
          target: {
            targetType: target.targetType,
            targetId: target.targetId,
          },
        },
        receipt: { id: this.createUuid(), attemptNumber: 1 },
      }),
    );
    if (response.status === 'authority_rejected') return response;
    if (response.status !== 'response' || !isJson(response.contentType)) {
      return { status: 'unavailable' };
    }
    if (response.statusCode === 202) {
      return { status: 'accepted', outcome: 'pending' };
    }
    if (response.statusCode !== 200) {
      return response.statusCode === 401
        ? { status: 'authority_rejected' }
        : { status: 'unavailable' };
    }
    try {
      const value: unknown = JSON.parse(response.body);
      if (
        !isRecord(value)
        || value.status !== 'synchronized'
        || !isRecord(value.decision)
        || ![
          'time_entry_started',
          'time_entry_stopped',
          'duplicate_scan_ignored',
          'active_entry_for_other_target_rejected',
          'escalation_required',
        ].includes(String(value.decision.status))
      ) return { status: 'unavailable' };
      return {
        status: 'accepted',
        outcome: value.decision.status as Extract<
          ManualTriggerResult,
          { status: 'accepted' }
        >['outcome'],
      };
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function isJson(value: string | null): boolean {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

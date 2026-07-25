import type { Pool } from 'pg';

export const DA5_V5_DEDUPE_PHASES = Object.freeze({
  'gate-b-customer': Object.freeze({ target: 'customer-a', user: 'employee' }),
  'gate-c-customer': Object.freeze({ target: 'customer-a', user: 'employee' }),
  'gate-c-project': Object.freeze({ target: 'project', user: 'employee' }),
  'gate-c-general': Object.freeze({ target: 'general-work', user: 'employee' }),
  'gate-d-customer': Object.freeze({ target: 'customer-a', user: 'employee' }),
  'gate-d-project': Object.freeze({ target: 'project', user: 'employee' }),
  'gate-d-general': Object.freeze({ target: 'general-work', user: 'employee' }),
  'gate-d-tag-a': Object.freeze({ target: 'customer-a', user: 'employee' }),
  'gate-d-tag-b': Object.freeze({ target: 'customer-b', user: 'employee' }),
} as const);

export type Da5V5DedupePhase = keyof typeof DA5_V5_DEDUPE_PHASES;
export type Da5V5DedupeTarget =
  (typeof DA5_V5_DEDUPE_PHASES)[Da5V5DedupePhase]['target'];

export interface Da5V5DedupeBinding {
  readonly target: Da5V5DedupeTarget;
  readonly user: 'employee';
}

interface ServerClockRow {
  readonly now: string;
}

export class Da5V5DedupeWindowController {
  private readonly baselines = new Map<Da5V5DedupePhase, string>();
  private readonly consumed = new Set<Da5V5DedupePhase>();
  private failed = false;

  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async capture(
    phase: Da5V5DedupePhase,
    binding: Da5V5DedupeBinding,
  ): Promise<'match' | 'mismatch'> {
    if (
      this.failed
      || !bindingMatches(phase, binding)
      || this.baselines.has(phase)
      || this.consumed.has(phase)
    ) {
      return this.fail();
    }
    let now: string | undefined;
    try {
      const result = await this.pool.query<ServerClockRow>(
        'SELECT pg_catalog.transaction_timestamp()::text AS now',
      );
      now = result.rows[0]?.now;
    } catch {
      return this.fail();
    }
    if (now === undefined || !isPostgresTimestampText(now)) {
      return this.fail();
    }
    this.baselines.set(phase, now);
    return 'match';
  }

  async check(
    phase: Da5V5DedupePhase,
    binding: Da5V5DedupeBinding,
  ): Promise<'match' | 'mismatch'> {
    const baseline = this.baselines.get(phase);
    this.baselines.delete(phase);
    this.consumed.add(phase);
    if (this.failed || !bindingMatches(phase, binding) || baseline === undefined) {
      return this.fail();
    }
    let elapsed: boolean | undefined;
    try {
      const result = await this.pool.query<{ readonly elapsed: boolean }>(
        `SELECT pg_catalog.transaction_timestamp()
                  > $1::timestamptz + interval '5 seconds' AS elapsed`,
        [baseline],
      );
      elapsed = result.rows[0]?.elapsed;
    } catch {
      return this.fail();
    }
    if (elapsed !== true) {
      return this.fail();
    }
    return 'match';
  }

  state(): Readonly<{
    readonly activeSlots: readonly Da5V5DedupePhase[];
    readonly consumedSlots: readonly Da5V5DedupePhase[];
    readonly failed: boolean;
  }> {
    return Object.freeze({
      activeSlots: Object.freeze([...this.baselines.keys()].sort()),
      consumedSlots: Object.freeze([...this.consumed].sort()),
      failed: this.failed,
    });
  }

  destroy(): void {
    this.baselines.clear();
    this.consumed.clear();
    this.failed = true;
  }

  private fail(): 'mismatch' {
    this.failed = true;
    return 'mismatch';
  }
}

function isPostgresTimestampText(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::?\d{2})?$/.test(value);
}

export function da5V5DedupeBinding(phase: Da5V5DedupePhase): Da5V5DedupeBinding {
  return DA5_V5_DEDUPE_PHASES[phase];
}

export function isDa5V5DedupePhase(value: string): value is Da5V5DedupePhase {
  return Object.prototype.hasOwnProperty.call(DA5_V5_DEDUPE_PHASES, value);
}

function bindingMatches(
  phase: Da5V5DedupePhase,
  binding: Da5V5DedupeBinding,
): boolean {
  const expected = DA5_V5_DEDUPE_PHASES[phase];
  return expected !== undefined
    && expected.user === binding.user
    && expected.target === binding.target;
}

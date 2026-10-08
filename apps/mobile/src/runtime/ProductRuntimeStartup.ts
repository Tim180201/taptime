/** Keeps thrown runtime startup failures separate from the session's own recovery states. */
export class ProductRuntimeStartup {
  private state: 'starting' | 'ready' | 'failed' = 'starting';
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private flight: Promise<void> | null = null;
  private generation = 0;
  constructor(
    private readonly runtime: { start(): Promise<void>; stop(): void },
    private readonly subscribeActive: (listener: () => void) => () => void,
  ) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  start(): Promise<void> {
    this.unsubscribe ??= this.subscribeActive(() => { void this.retry(); });
    return this.run();
  }
  retry(): Promise<void> {
    if (this.flight !== null) return this.flight;
    if (this.state !== 'failed') return Promise.resolve();
    this.runtime.stop();
    return this.run();
  }
  stop(): void {
    ++this.generation;
    this.unsubscribe?.();this.unsubscribe = null;
    this.flight = null;
    this.runtime.stop();
  }
  private run(): Promise<void> {
    if (this.flight !== null) return this.flight;
    const generation = this.generation;
    this.publish('starting');
    const flight = this.runtime.start().then(
      () => { if (generation === this.generation) this.publish('ready'); },
      () => { if (generation === this.generation) this.publish('failed'); },
    ).finally(() => { if (this.flight === flight) this.flight = null; });
    this.flight = flight;
    return flight;
  }
  private publish(state: typeof this.state): void {
    this.state = state;
    for (const listener of this.listeners) { try { listener(); } catch {} }
  }
}

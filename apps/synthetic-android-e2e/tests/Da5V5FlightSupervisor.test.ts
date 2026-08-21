import { EventEmitter } from 'node:events';
import {
  chmodSync,
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  renameSync,
  symlinkSync,
} from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_INPUT_EOF_ABORT_REASON,
  DA5_V5_INPUT_ORDER_ABORT_REASON,
  DA5_V5_FAST_FLIGHT_PLAN_SHA256,
  da5V5FlightIdentity,
  type Da5V5FlightRunResult,
  type Da5V5HumanInput,
  type Da5V5HumanPrompt,
} from '../src/Da5V5FlightController.js';
import {
  DA5_V5_TERMINAL_OUTCOME_CLASSES,
  runDa5V5FlightSupervisor,
  type Da5V5FlightSupervisorDependencies,
  type Da5V5FlightSupervisorController,
  type Da5V5TerminalEnvelopeFaultPoint,
  type Da5V5TerminalOutcomeClass,
} from '../src/Da5V5FlightSupervisor.js';

const bindingSetId = 'a'.repeat(64);
const runNonce = '1'.repeat(64);
const generatedCredentialValue = '000102030405060708090a0b0c0d0e0f'
  + '101112131415161718191a1b1c1d1e1f';
const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    await makeWritable(root);
    await rm(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 same-TTY Flight Supervisor', () => {
  it('generates one exact lowercase-hex credential, zeroes its entropy and waits for CLOSE',
    async () => {
    const entropy = Buffer.from(Array.from({ length: 32 }, (_value, index) => index));
    const createCredentialEntropy = vi.fn(() => entropy);
    const harness = await createHarness({ createCredentialEntropy });
    const credentialReference: { value: Buffer | null } = { value: null };
    harness.output.onWrite = (value, flush) => {
      flush();
    };
    let settled = false;
    const operation = harness.run(({ credential }) => {
      expect(credential).toHaveLength(64);
      expect(credential.toString('ascii')).toBe(generatedCredentialValue);
      expect(credential.every((byte) => (
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
      ))).toBe(true);
      credentialReference.value = credential;
      return controllerReturning(resultFixture(harness.innerReceiptRoot));
    }).finally(() => { settled = true; });

    await waitFor(() => harness.output.text().includes('terminal outcome acknowledgement'));
    expect(settled).toBe(false);
    expect(harness.input.isRaw).toBe(true);
    expect(harness.input.listenerCount('data')).toBe(1);
    expect(createCredentialEntropy).toHaveBeenCalledTimes(1);
    expect(entropy.every((byte) => byte === 0)).toBe(true);
    expect(harness.output.text()).not.toContain(generatedCredentialValue);
    expect(harness.output.text()).not.toContain('hidden credential input');
    expect(harness.output.text()).not.toContain('zsh');
    harness.input.send('CLOSE\r');
    const result = await operation;

    expect(result).toMatchObject({
      close_acknowledged: true,
      evidence_status: 'SEALED',
      exit_code: 0,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
    });
    expect(credentialReference.value).not.toBeNull();
    expect(credentialReference.value?.every((byte) => byte === 0)).toBe(true);
    expect(harness.input.isRaw).toBe(false);
    expect(harness.input.isPaused()).toBe(true);
    expect(harness.input.listenerCount('data')).toBe(0);
    expect(result.final_root).not.toBeNull();
    const rootStatus = await stat(result.final_root as string);
    expect(rootStatus.mode & 0o777).toBe(0o555);
    expect(await readdir(result.final_root as string)).toEqual([
      'evidence-manifest.json',
      'terminal-receipt.json',
    ]);
    for (const name of ['evidence-manifest.json', 'terminal-receipt.json']) {
      expect((await stat(join(result.final_root as string, name))).mode & 0o777).toBe(0o444);
    }
    const sealedEnvelope = Buffer.concat(await Promise.all([
      readFile(join(result.final_root as string, 'evidence-manifest.json')),
      readFile(join(result.final_root as string, 'terminal-receipt.json')),
    ])).toString('utf8');
    expect(sealedEnvelope).not.toContain(generatedCredentialValue);
    expect(sealedEnvelope).not.toMatch(/credential|password|secret/iu);
  });

  it.each([31, 33])('rejects and zeroes a %i-byte entropy Buffer before controller construction',
    async (length) => {
      const entropy = Buffer.alloc(length, 0xab);
      const factory = vi.fn(() => controllerReturning(resultFixture(null)));
      const harness = await createHarness({ createCredentialEntropy: () => entropy });
      drivePrompts(harness);
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe(
        'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN',
      );
      expect(factory).not.toHaveBeenCalled();
      expect(entropy.every((byte) => byte === 0)).toBe(true);
    });

  it('rejects a non-Buffer entropy value without constructing the controller', async () => {
    const factory = vi.fn(() => controllerReturning(resultFixture(null)));
    const harness = await createHarness({
      createCredentialEntropy: (() => new Uint8Array(32)) as unknown as () => Buffer,
    });
    drivePrompts(harness);
    const result = await harness.run(factory);
    expect(result.outcome_class).toBe(
      'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN',
    );
    expect(factory).not.toHaveBeenCalled();
  });

  it('classifies an entropy-factory throw without disclosing it or attempting a fallback',
    async () => {
      const createCredentialEntropy = vi.fn((): Buffer => {
        throw new Error('private entropy detail');
      });
      const factory = vi.fn(() => controllerReturning(resultFixture(null)));
      const harness = await createHarness({ createCredentialEntropy });
      drivePrompts(harness);
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe(
        'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN',
      );
      expect(createCredentialEntropy).toHaveBeenCalledTimes(1);
      expect(factory).not.toHaveBeenCalled();
      expect(harness.output.text()).not.toContain('private entropy detail');
    });

  it('rejects early terminal bytes during automatic generation and zeroes both Buffers',
    async () => {
      const entropy = Buffer.alloc(32, 0xab);
      const factory = vi.fn(() => controllerReturning(resultFixture(null)));
      let harness: Awaited<ReturnType<typeof createHarness>>;
      harness = await createHarness({
        createCredentialEntropy: () => {
          setImmediate(() => harness.input.send('P'));
          return entropy;
        },
      });
      drivePrompts(harness);
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe('PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN');
      expect(factory).not.toHaveBeenCalled();
      expect(entropy.every((byte) => byte === 0)).toBe(true);
    });

  it('classifies synchronous controller construction failure with spawn still unreachable',
    async () => {
      const entropy = Buffer.alloc(32, 0xab);
      let credentialReference: Buffer | null = null;
      const harness = await createHarness({ createCredentialEntropy: () => entropy });
      const factory = vi.fn(({ credential }: { readonly credential: Buffer }) => {
        credentialReference = credential;
        throw new Error('private constructor detail');
      });
      drivePrompts(harness);
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe(
        'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN',
      );
      expect(factory).toHaveBeenCalledTimes(1);
      expect(entropy.every((byte) => byte === 0)).toBe(true);
      expect(credentialReference).not.toBeNull();
      expect((credentialReference as unknown as Buffer).every((byte) => byte === 0)).toBe(true);
      expect(harness.output.text()).not.toContain('private constructor detail');
    });

  it.each([
    ['sealed', true, 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED'],
    ['unsealed', false, 'CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED'],
  ] as const)('classifies a controller-returned %s inner receipt without Product claims',
    async (_name, sealed, expected) => {
      const harness = await createHarness();
      drivePrompts(harness);
      const result = await harness.run(() => controllerReturning(
        resultFixture(sealed ? harness.innerReceiptRoot : null),
      ));
      expect(result.outcome_class).toBe(expected);
      expect(harness.output.text()).toContain(
        '"product_and_cleanup_authority":"INNER_CONTROLLER_RECEIPT_ONLY"',
      );
    });

  it('treats a stale or arbitrary returned receipt path as inner-unsealed', async () => {
    const harness = await createHarness();
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(
      resultFixture('/private/tmp/arbitrary-stale-inner-root'),
    ));
    expect(result.outcome_class).toBe('CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED');
    expect(result.exit_code).toBe(1);
  });

  it.each(['run', 'plan'] as const)(
    'treats a returned result with mismatched %s identity as managed or unproven',
    async (field) => {
      const harness = await createHarness();
      drivePrompts(harness);
      const fixture = resultFixture(harness.innerReceiptRoot);
      const mismatched = Object.freeze({
        ...fixture,
        ...(field === 'run'
          ? { run_id: 'f'.repeat(32) }
          : { plan_sha256: 'f'.repeat(64) }),
      });
      const result = await harness.run(() => controllerReturning(mismatched));
      expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
      expect(result.exit_code).toBe(1);
    },
  );

  it('classifies an unexpected run throw conservatively and discloses no raw error', async () => {
    const harness = await createHarness();
    drivePrompts(harness);
    const result = await harness.run(() => ({
      run: async () => { throw new Error('private controller detail'); },
    }));
    expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
    expect(harness.output.text()).not.toContain('private controller detail');
  });

  it('writes each Human prompt once, opens only after flush and quarantines between prompts',
    async () => {
      const harness = await createHarness();
      const prompt = humanPrompt();
      let humanPromptCount = 0;
      harness.output.onWrite = (value, flush) => {
        flush();
        if (value.includes('da5_v5_human_prompt=')) {
          humanPromptCount += 1;
          harness.input.send('PASS\n');
        } else if (isClosePrompt(value)) {
          setImmediate(() => harness.input.send('CLOSE\n'));
        }
      };
      const result = await harness.run(({ humanInput }) => ({
        run: async () => {
          expect(await humanInput.request(prompt)).toBe('PASS');
          return resultFixture(harness.innerReceiptRoot);
        },
      }));
      expect(result.outcome_class).toBe('CONTROLLER_RETURNED_INNER_RECEIPT_SEALED');
      expect(humanPromptCount).toBe(1);
      expect(harness.output.text().match(/da5_v5_human_prompt=/gu)).toHaveLength(1);
    });

  it('turns bytes during managed machine work into a latched order violation', async () => {
    const harness = await createHarness();
    drivePrompts(harness);
    const result = await harness.run(({ signal }) => ({
      run: async () => {
        harness.input.send('PASS\n');
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBe(DA5_V5_INPUT_ORDER_ABORT_REASON);
        throw new Error('managed stop');
      },
    }));
    expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
  });

  it.each([
    ['input-order', DA5_V5_INPUT_ORDER_ABORT_REASON],
    ['input-eof', DA5_V5_INPUT_EOF_ABORT_REASON],
  ] as const)('delivers %s abort semantics to managed transfer without password disclosure',
    async (event, expectedReason) => {
      const harness = await createHarness();
      drivePrompts(harness);
      let credentialReference: Buffer | null = null;
      const result = await harness.run(({ credential, signal }) => {
        credentialReference = credential;
        return {
          run: async () => {
            if (event === 'input-order') harness.input.send('PASS\n');
            else harness.input.emit('end');
            expect(signal.aborted).toBe(true);
            expect(signal.reason).toBe(expectedReason);
            throw new Error('managed transfer stopped');
          },
        };
      });
      expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
      expect(credentialReference).not.toBeNull();
      expect((credentialReference as unknown as Buffer).every((byte) => byte === 0)).toBe(true);
      expect(harness.output.text()).not.toContain(generatedCredentialValue);
      expect(harness.output.text()).not.toContain('managed transfer stopped');
    });

  it('never buffers partial input between two Human prompts', async () => {
    const harness = await createHarness();
    const prompt = humanPrompt();
    drivePrompts(harness, 'PASS\n');
    const result = await harness.run(({ humanInput, signal }) => ({
      run: async () => {
        expect(await humanInput.request(prompt, signal)).toBe('PASS');
        harness.input.send('P');
        await expect(humanInput.request(prompt, signal)).rejects.toThrow();
        throw new Error('managed stop');
      },
    }));
    expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
  });

  it.each(['end', 'close', 'error'] as const)(
    'fails closed when input emits %s during automatic-generation quarantine',
    async (event) => {
      let harness: Awaited<ReturnType<typeof createHarness>>;
      harness = await createHarness({
        createCredentialEntropy: () => {
          setImmediate(() => {
            if (event === 'error') {
              harness.input.emit('error', new Error('private input detail'));
              harness.input.emit('error', new Error('second private input detail'));
            } else harness.input.emit(event);
          });
          return Buffer.alloc(32, 0xab);
        },
      });
      const factory = vi.fn(() => controllerReturning(resultFixture(null)));
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe('PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN');
      expect(result.close_acknowledged).toBe(false);
      expect(factory).not.toHaveBeenCalled();
      expect(harness.output.text()).not.toContain('private input detail');
      expect(harness.input.isRaw).toBe(false);
    },
  );

  it('latches repeated signals during pending preparation and commits no-child signal truth',
    async () => {
      let signalHandler = (): void => undefined;
      const harness = await createHarness({
        fault: (point) => {
          if (point === 'stage-mkdir') {
            signalHandler();
            signalHandler();
          }
        },
        installSignalHandlers: (handler) => {
          signalHandler = handler;
          return () => undefined;
        },
      });
      drivePrompts(harness);
      const factory = vi.fn(() => controllerReturning(resultFixture(null)));
      const result = await harness.run(factory);
      expect(result.outcome_class).toBe('PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN');
      expect(factory).not.toHaveBeenCalled();
    });

  it('latches repeated signals during automatic generation and zeroes the entropy', async () => {
    let signalHandler = (): void => undefined;
    const entropy = Buffer.alloc(32, 0xab);
    const harness = await createHarness({
      installSignalHandlers: (handler) => {
        signalHandler = handler;
        return () => undefined;
      },
      createCredentialEntropy: () => {
        signalHandler();
        signalHandler();
        return entropy;
      },
    });
    drivePrompts(harness);
    const factory = vi.fn(() => controllerReturning(resultFixture(null)));
    const result = await harness.run(factory);
    expect(result.outcome_class).toBe('PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN');
    expect(factory).not.toHaveBeenCalled();
    expect(entropy.every((byte) => byte === 0)).toBe(true);
  });

  it('downgrades repeated signals during a returning controller', async () => {
    let signalHandler = (): void => undefined;
    const harness = await createHarness({
      installSignalHandlers: (handler) => {
        signalHandler = handler;
        return () => undefined;
      },
    });
    drivePrompts(harness);
    const result = await harness.run(({ credential }) => ({
      run: async () => {
        signalHandler();
        signalHandler();
        expect(credential.every((byte) => byte === 0)).toBe(true);
        return resultFixture(null);
      },
    }));
    expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
    expect(result.exit_code).toBe(1);
  });

  it('downgrades a post-return precommit signal at the adjacent rename latch', async () => {
    let signalHandler = (): void => undefined;
    const harness = await createHarness({
      fault: (point) => {
        if (point === 'final-rename') {
          signalHandler();
          signalHandler();
        }
      },
      installSignalHandlers: (handler) => {
        signalHandler = handler;
        return () => undefined;
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result.outcome_class).toBe('CONTROLLER_MANAGED_OR_UNPROVEN');
    expect(result.final_root).toMatch(/CONTROLLER_MANAGED_OR_UNPROVEN$/u);
    expect(result.exit_code).toBe(1);
  });

  it('rejects bytes after commit but before the visible CLOSE prompt', async () => {
    const harness = await createHarness();
    harness.output.onWrite = (value, flush) => {
      flush();
      if (value.startsWith('da5_v5_flight_terminal=')) {
        harness.input.send('CLOSE\n');
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
    });
    expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
  });

  it('permanently closes a retained Human input port before terminal publication', async () => {
    const harness = await createHarness();
    let retainedHumanInput: Da5V5HumanInput | null = null;
    let lateRequest: Promise<string> | null = null;
    harness.output.onWrite = (value, flush) => {
      flush();
      if (value.startsWith('da5_v5_flight_terminal=')) {
        lateRequest = retainedHumanInput?.request(humanPrompt()) ?? null;
        if (lateRequest !== null) void lateRequest.catch(() => undefined);
      } else if (isClosePrompt(value)) {
        setImmediate(() => harness.input.send('CLOSE\n'));
      }
    };
    const result = await harness.run(({ humanInput }) => {
      retainedHumanInput = humanInput;
      return controllerReturning(resultFixture(harness.innerReceiptRoot));
    });
    expect(lateRequest).not.toBeNull();
    await expect(lateRequest as unknown as Promise<string>).rejects.toThrow();
    expect(harness.output.text()).not.toContain('da5_v5_human_prompt=');
    expect(result).toMatchObject({
      close_acknowledged: true,
      exit_code: 0,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
    });
  });

  it('does not offer CLOSE or report success when the terminal status flush fails', async () => {
    const harness = await createHarness();
    let closePromptWrites = 0;
    harness.output.onWrite = (value, flush) => {
      if (value.startsWith('da5_v5_flight_terminal=')) {
        flush(new Error('private status write failure'));
        return;
      }
      if (isClosePrompt(value)) {
        closePromptWrites += 1;
        flush();
        setImmediate(() => harness.input.send('CLOSE\n'));
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
      terminal_outcome_published: false,
    });
    expect(closePromptWrites).toBe(0);
    expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
    expect(harness.output.text()).not.toContain('private status write failure');
    expectTerminalOwnershipRestored(harness);
  });

  it('ignores a late callback error after an already successful status flush', async () => {
    const harness = await createHarness();
    harness.output.onWrite = (value, flush) => {
      flush();
      if (value.startsWith('da5_v5_flight_terminal=')) {
        setImmediate(() => flush(new Error('private late callback error')));
      } else if (isClosePrompt(value)) {
        setImmediate(() => harness.input.send('CLOSE\n'));
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: true,
      evidence_status: 'SEALED',
      exit_code: 0,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
      terminal_outcome_published: true,
    });
    expect(harness.output.text()).not.toContain('private late callback error');
    expectTerminalOwnershipRestored(harness);
  });

  it('clears every bounded output timer after successful terminal closure', async () => {
    vi.useFakeTimers();
    try {
      const harness = await createHarness();
      harness.output.onWrite = (value, flush) => {
        flush();
        if (isClosePrompt(value)) harness.input.send('CLOSE\n');
      };
      const operation = harness.run(() => controllerReturning(
        resultFixture(harness.innerReceiptRoot),
      ));
      await vi.runAllTimersAsync();
      const result = await operation;
      expect(result.exit_code).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expectTerminalOwnershipRestored(harness);
    } finally {
      vi.useRealTimers();
    }
  });

  it('owns an asynchronous stdout error during automatic generation', async () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      createCredentialEntropy: () => {
        setImmediate(() => harness.output.emit('error', new Error('private prompt error')));
        return Buffer.alloc(32, 0xab);
      },
    });
    const factory = vi.fn(() => controllerReturning(resultFixture(null)));
    const result = await harness.run(factory);
    expect(result).toMatchObject({
      close_acknowledged: false,
      exit_code: 1,
      outcome_class: 'PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN',
      terminal_outcome_published: false,
    });
    expect(factory).not.toHaveBeenCalled();
    expect(harness.output.text()).not.toContain('private prompt error');
    expectTerminalOwnershipRestored(harness);
  });

  it('owns an asynchronous stdout error during a managed controller', async () => {
    const harness = await createHarness();
    drivePrompts(harness);
    const result = await harness.run(() => ({
      run: async () => {
        await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
        harness.output.emit('error', new Error('private controller output error'));
        return resultFixture(harness.innerReceiptRoot);
      },
    }));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      outcome_class: 'CONTROLLER_MANAGED_OR_UNPROVEN',
      terminal_outcome_published: false,
    });
    expect(harness.output.text()).not.toContain('private controller output error');
    expectTerminalOwnershipRestored(harness);
  });

  it('owns an asynchronous stdout error during terminal status publication', async () => {
    const harness = await createHarness();
    harness.output.onWrite = (value, flush) => {
      if (value.startsWith('da5_v5_flight_terminal=')) {
        setImmediate(() => harness.output.emit('error', new Error('private status error')));
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      terminal_outcome_published: false,
    });
    expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
    expectTerminalOwnershipRestored(harness);
  });

  it.each(['error', 'close'] as const)(
    'owns an asynchronous stdout %s during the CLOSE prompt',
    async (event) => {
      const harness = await createHarness();
      harness.output.onWrite = (value, flush) => {
        if (value.startsWith('da5_v5_flight_terminal=')) {
          flush();
        } else if (isClosePrompt(value)) {
          setImmediate(() => {
            if (event === 'error') {
              harness.output.emit('error', new Error('private acknowledgement error'));
            } else harness.output.emit('close');
          });
        }
      };
      const result = await harness.run(() => controllerReturning(
        resultFixture(harness.innerReceiptRoot),
      ));
      expect(result).toMatchObject({
        close_acknowledged: false,
        evidence_status: 'SEALED',
        exit_code: 1,
        terminal_outcome_published: true,
      });
      expect(harness.output.text()).not.toContain('private acknowledgement error');
      expectTerminalOwnershipRestored(harness);
    },
  );

  it('cancels a stalled status flush on a persistent signal without reclassifying Evidence',
    async () => {
      let signalHandler = (): void => undefined;
      const harness = await createHarness({
        installSignalHandlers: (handler) => {
          signalHandler = handler;
          return () => undefined;
        },
      });
      harness.output.onWrite = (value, flush) => {
        if (value.startsWith('da5_v5_flight_terminal=')) {
          setImmediate(() => signalHandler());
        }
      };
      const result = await harness.run(() => controllerReturning(
        resultFixture(harness.innerReceiptRoot),
      ));
      expect(result).toMatchObject({
        close_acknowledged: false,
        evidence_status: 'SEALED',
        exit_code: 1,
        outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
        terminal_outcome_published: false,
      });
      expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
      expectTerminalOwnershipRestored(harness);
    });

  it('cancels a stalled status flush on stdin EOF', async () => {
    const harness = await createHarness();
    harness.output.onWrite = (value, flush) => {
      if (value.startsWith('da5_v5_flight_terminal=')) {
        setImmediate(() => harness.input.emit('end'));
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      terminal_outcome_published: false,
    });
    expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
    expectTerminalOwnershipRestored(harness);
  });

  it('times out a stalled bounded status flush and ignores its late callback', async () => {
    const harness = await createHarness({ outputFlushTimeoutMilliseconds: 10 });
    let lateFlush: ((error?: Error) => void) | null = null;
    harness.output.onWrite = (value, flush) => {
      if (value.startsWith('da5_v5_flight_terminal=')) {
        lateFlush = flush;
      }
    };
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: false,
      evidence_status: 'SEALED',
      exit_code: 1,
      terminal_outcome_published: false,
    });
    expect(lateFlush).not.toBeNull();
    (lateFlush as unknown as (error?: Error) => void)();
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    expectTerminalOwnershipRestored(harness);
  });

  it('times out a stalled bounded CLOSE-prompt flush without changing sealed Evidence',
    async () => {
      const harness = await createHarness({ outputFlushTimeoutMilliseconds: 10 });
      let lateFlush: ((error?: Error) => void) | null = null;
      harness.output.onWrite = (value, flush) => {
        if (value.startsWith('da5_v5_flight_terminal=')) {
          flush();
        } else if (isClosePrompt(value)) {
          lateFlush = flush;
        }
      };
      const result = await harness.run(() => controllerReturning(
        resultFixture(harness.innerReceiptRoot),
      ));
      expect(result).toMatchObject({
        close_acknowledged: false,
        evidence_status: 'SEALED',
        exit_code: 1,
        terminal_outcome_published: true,
      });
      expect(lateFlush).not.toBeNull();
      (lateFlush as unknown as (error?: Error) => void)();
      await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
      expectTerminalOwnershipRestored(harness);
    });

  const faultPoints: readonly Da5V5TerminalEnvelopeFaultPoint[] = [
    'parent-validate',
    'collision-check',
    'stage-mkdir',
    'receipt-open',
    'receipt-write',
    'receipt-fsync',
    'receipt-chmod',
    'manifest-open',
    'manifest-write',
    'manifest-fsync',
    'manifest-chmod',
    'stage-fsync',
    'stage-chmod',
    'pending-rename',
    'parent-fsync',
    'pending-reread',
    'pending-validate',
    'final-collision-check',
    'final-rename',
  ];

  it.each(faultPoints)('keeps every %s fault nonauthoritative with no selected final',
    async (faultPoint) => {
      const harness = await createHarness({
        fault: (point) => {
          if (point === faultPoint) throw new Error('injected envelope fault');
        },
      });
      drivePrompts(harness);
      const result = await harness.run(() => controllerReturning(resultFixture(null)));
      expect(result).toMatchObject({
        evidence_status: 'EVIDENCE_UNSEALED',
        exit_code: 1,
        final_root: null,
        outcome_class: 'EVIDENCE_UNSEALED',
      });
      const names = await readdir(harness.evidenceParent);
      for (const outcome of DA5_V5_TERMINAL_OUTCOME_CLASSES) {
        expect(names.some((name) => name.endsWith(outcome))).toBe(false);
      }
      expect(harness.output.text()).not.toContain('injected envelope fault');
      expect(harness.output.text()).not.toContain('"outcome_class":"PASS"');
    });

  it('rejects a stage-root inode replacement during directory sealing', async () => {
    let alias = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'stage-chmod') return;
        const stage = stageRoot(harness);
        alias = `${stage}.original`;
        renameSync(stage, alias);
        mkdirSync(stage, { mode: 0o700 });
        for (const name of ['evidence-manifest.json', 'terminal-receipt.json']) {
          renameSync(join(alias, name), join(stage, name));
        }
        chmodSync(stage, 0o555);
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(alias).isDirectory()).toBe(true);
    expect(lstatSync(stageRoot(harness)).isDirectory()).toBe(true);
  });

  it('treats a last-moment dangling pending symlink as an untouched collision', async () => {
    let collision = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'pending-rename') return;
        collision = pendingRoot(harness);
        symlinkSync(join(harness.evidenceParent, 'missing-pending-target'), collision, 'dir');
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(collision).isSymbolicLink()).toBe(true);
  });

  it('rejects a pending-root symlink substitution and leaves the alias untouched',
    async () => {
      let harness: Awaited<ReturnType<typeof createHarness>>;
      harness = await createHarness({
        fault: (point) => {
          if (point !== 'pending-reread') return;
          const pending = pendingRoot(harness);
          const alias = `${pending}.alias`;
          renameSync(pending, alias);
          symlinkSync(alias, pending, 'dir');
        },
      });
      drivePrompts(harness);
      const result = await harness.run(() => controllerReturning(resultFixture(null)));
      const pending = pendingRoot(harness);
      expect(result).toMatchObject({
        evidence_status: 'EVIDENCE_UNSEALED',
        final_root: null,
        outcome_class: 'EVIDENCE_UNSEALED',
      });
      expect(lstatSync(pending).isSymbolicLink()).toBe(true);
      expect(lstatSync(`${pending}.alias`).isDirectory()).toBe(true);
      expect(await readdir(`${pending}.alias`)).toEqual([
        'evidence-manifest.json',
        'terminal-receipt.json',
      ]);
    });

  it('rejects a hardlinked pending payload and leaves the extra link untouched', async () => {
    let hardlink = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'pending-reread') return;
        hardlink = join(harness.evidenceParent, 'payload-hardlink');
        linkSync(join(pendingRoot(harness), 'terminal-receipt.json'), hardlink);
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(hardlink).isFile()).toBe(true);
    expect(lstatSync(hardlink).nlink).toBe(2);
  });

  it('rejects a same-content pending-root inode replacement before final rename', async () => {
    let alias = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'final-rename') return;
        const pending = pendingRoot(harness);
        alias = `${pending}.original`;
        renameSync(pending, alias);
        mkdirSync(pending, { mode: 0o700 });
        for (const name of ['evidence-manifest.json', 'terminal-receipt.json']) {
          copyFileSync(join(alias, name), join(pending, name));
          chmodSync(join(pending, name), 0o444);
        }
        chmodSync(pending, 0o555);
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(alias).isDirectory()).toBe(true);
    expect(lstatSync(pendingRoot(harness)).isDirectory()).toBe(true);
  });

  it('rejects an evidence-parent inode replacement before final rename', async () => {
    let originalParent = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'final-rename') return;
        originalParent = `${harness.evidenceParent}.original`;
        renameSync(harness.evidenceParent, originalParent);
        mkdirSync(harness.evidenceParent, { mode: 0o700 });
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(originalParent).isDirectory()).toBe(true);
    expect(await readdir(originalParent)).toContain(
      `.flight-terminal-${da5V5FlightIdentity(bindingSetId, runNonce).runId}.pending`,
    );
    expect(await readdir(harness.evidenceParent)).toEqual([]);
  });

  it('treats a dangling selected-final symlink as an untouched collision', async () => {
    let collision = '';
    let harness: Awaited<ReturnType<typeof createHarness>>;
    harness = await createHarness({
      fault: (point) => {
        if (point !== 'final-rename') return;
        collision = selectedFinalRoot(
          harness,
          'CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED',
        );
        symlinkSync(join(harness.evidenceParent, 'missing-target'), collision, 'dir');
      },
    });
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result).toMatchObject({
      evidence_status: 'EVIDENCE_UNSEALED',
      final_root: null,
      outcome_class: 'EVIDENCE_UNSEALED',
    });
    expect(lstatSync(collision).isSymbolicLink()).toBe(true);
  });

  it('fails closed on an actual selected-path collision without changing the collision',
    async () => {
      const harness = await createHarness();
      const collision = join(
        harness.evidenceParent,
        `flight-terminal-${da5V5FlightIdentity(bindingSetId, runNonce).runId}`
          + '-CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED',
      );
      await mkdir(collision, { mode: 0o700 });
      drivePrompts(harness);
      const before = await readdir(harness.evidenceParent);
      const result = await harness.run(() => controllerReturning(resultFixture(null)));
      expect(result).toMatchObject({
        evidence_status: 'EVIDENCE_UNSEALED',
        final_root: null,
        outcome_class: 'EVIDENCE_UNSEALED',
      });
      expect(await readdir(harness.evidenceParent)).toEqual(before);
    });

  it('creates exactly one selected final and offers no second commit path', async () => {
    const harness = await createHarness();
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    const names = await readdir(harness.evidenceParent);
    expect(names.filter((name) => name.startsWith('flight-terminal-'))).toHaveLength(1);
    expect(names.some((name) => name.includes('.pending'))).toBe(false);
    expect(names.some((name) => name.includes('.stage'))).toBe(false);
    expect(result.outcome_class).toBe('CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED');
  });

  it('keeps a committed final authoritative when terminal output hits EPIPE', async () => {
    const harness = await createHarness();
    harness.output.onWrite = (value, flush) => {
      if (value.startsWith('da5_v5_flight_terminal=')) {
        flush(new Error('EPIPE'));
        return;
      }
      flush(new Error('EPIPE'));
    };
    const result = await harness.run(() => controllerReturning(resultFixture(null)));
    expect(result.evidence_status).toBe('SEALED');
    expect(result.final_root).not.toBeNull();
    expect(result.close_acknowledged).toBe(false);
    expect(result.terminal_outcome_published).toBe(false);
    expect(result.exit_code).toBe(1);
    expect(harness.output.text()).not.toContain('terminal outcome acknowledgement');
    expect((await stat(result.final_root as string)).isDirectory()).toBe(true);
    expectTerminalOwnershipRestored(harness);
  });

  it('rejects a different terminal endpoint before raw capture', async () => {
    const harness = await createHarness({ verifySameTty: () => false });
    await expect(harness.run(() => controllerReturning(resultFixture(null))))
      .rejects.toMatchObject({ code: 'SAME_TTY_REQUIRED' });
    expect(harness.input.isRaw).toBe(false);
    expect(harness.input.listenerCount('data')).toBe(0);
  });

  it('restores raw and flow state when resume fails during attachment', async () => {
    const harness = await createHarness();
    harness.input.failResume = true;
    await expect(harness.run(() => controllerReturning(resultFixture(null))))
      .rejects.toMatchObject({ code: 'RAW_MODE_SETUP_FAILED' });
    expect(harness.input.isRaw).toBe(false);
    expect(harness.input.isPaused()).toBe(true);
    expect(harness.input.listenerCount('data')).toBe(0);
  });

  it('keeps close non-throwing and uninstalls signals when terminal pause fails', async () => {
    const uninstall = vi.fn();
    const harness = await createHarness({
      installSignalHandlers: () => uninstall,
    });
    harness.input.failPause = true;
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result.exit_code).toBe(1);
    expect(harness.input.isRaw).toBe(false);
    expect(harness.input.listenerCount('data')).toBe(0);
    expect(uninstall).toHaveBeenCalledTimes(1);
  });

  it('keeps close non-throwing and returns non-success when raw restoration fails', async () => {
    const uninstall = vi.fn();
    const harness = await createHarness({
      installSignalHandlers: () => uninstall,
    });
    harness.input.failRawRestore = true;
    drivePrompts(harness);
    const result = await harness.run(() => controllerReturning(
      resultFixture(harness.innerReceiptRoot),
    ));
    expect(result).toMatchObject({
      close_acknowledged: true,
      evidence_status: 'SEALED',
      exit_code: 1,
      outcome_class: 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
      terminal_outcome_published: true,
    });
    expect(harness.input.isRaw).toBe(true);
    expect(harness.input.listenerCount('data')).toBe(0);
    expect(harness.output.listenerCount('error')).toBe(0);
    expect(uninstall).toHaveBeenCalledTimes(1);
  });

  it('rejects an already-flowing stdin owner before raw capture', async () => {
    const harness = await createHarness();
    harness.input.readableFlowing = true;
    await expect(harness.run(() => controllerReturning(resultFixture(null))))
      .rejects.toMatchObject({ code: 'INPUT_OWNER_PRESENT' });
    expect(harness.input.isRaw).toBe(false);
  });
});

async function createHarness(
  dependencyOverrides: Partial<Da5V5FlightSupervisorDependencies> = {},
) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'da5-v5-flight-supervisor-')));
  temporaryRoots.push(root);
  const evidenceParent = join(root, 'evidence');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(evidenceParent, { mode: 0o700 }));
  const input = new FakeTtyInput();
  const output = new FakeOutput();
  const innerReceiptRoot = join(
    evidenceParent,
    `flight-${da5V5FlightIdentity(bindingSetId, runNonce).receiptId}`,
  );
  return {
    evidenceParent,
    innerReceiptRoot,
    input,
    output,
    run: (factory: (input: Readonly<{
      readonly credential: Buffer;
      readonly humanInput: Da5V5HumanInput;
      readonly runNonce: string;
      readonly signal: AbortSignal;
    }>) => Da5V5FlightSupervisorController) => runDa5V5FlightSupervisor({
      bindingSetId,
      createController: factory,
      evidenceParentPath: evidenceParent,
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
      repositoryRootPath: process.cwd(),
    }, {
      createCredentialEntropy: () => Buffer.from(
        Array.from({ length: 32 }, (_value, index) => index),
      ),
      createRunNonce: () => runNonce,
      verifySameTty: () => true,
      ...dependencyOverrides,
    }),
  };
}

function drivePrompts(
  harness: Awaited<ReturnType<typeof createHarness>>,
  humanResponse = 'PASS\n',
): void {
  harness.output.onWrite = (value, flush) => {
    flush();
    if (value.includes('da5_v5_human_prompt=')) {
      setImmediate(() => harness.input.send(humanResponse));
    } else if (isClosePrompt(value)) {
      setImmediate(() => harness.input.send('CLOSE\n'));
    }
  };
}

function resultFixture(receiptRoot: string | null): Da5V5FlightRunResult {
  const unobserved = Object.freeze({ equality: 'unproved' as const, observation: 'unobserved' as const });
  return Object.freeze({
    attestation: Object.freeze({
      android: 'match' as const,
      bound_postgres_processes: 'match' as const,
      checked_ports: Object.freeze([3000, 54321, 55435] as const),
      operator_processes: 'match' as const,
      owned_listeners: 'match' as const,
      product_equality: Object.freeze({
        aggregates: unobserved,
        invariants: unobserved,
        queue: Object.freeze({ ...unobserved, reason: 'operator_schema_has_no_queue_field' as const }),
        schema_version: 1 as const,
        tag_roles: unobserved,
      }),
      schema_version: 1 as const,
      status: 'match' as const,
      task_roots: 'match' as const,
    }),
    attempted_outcome: receiptRoot === null ? 'FAIL_CLOSED' : 'PASS',
    cleanup: 'MATCH',
    failure_reason: receiptRoot === null ? 'RECEIPT_SEAL_FAILURE' : null,
    fast_lane: 'STOP',
    invalid_receipt_root: null,
    plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
    receipt_root: receiptRoot,
    run_id: da5V5FlightIdentity(bindingSetId, runNonce).runId,
  });
}

function controllerReturning(result: Da5V5FlightRunResult): Da5V5FlightSupervisorController {
  return Object.freeze({ run: async () => result });
}

function humanPrompt(): Da5V5HumanPrompt {
  return Object.freeze({
    action: 'Confirm the exact visible Product state.',
    allowed_response: Object.freeze(['PASS', 'FAIL', 'AMBIGUOUS', 'ABORT']),
    button: 'Anmelden',
    do_not: 'Do not infer hidden state.',
    field: 'Product result',
    screen: 'TapTim.e',
  });
}

function isClosePrompt(value: string): boolean {
  return value.includes('"field":"terminal outcome acknowledgement"');
}

function pendingRoot(harness: Awaited<ReturnType<typeof createHarness>>): string {
  return join(
    harness.evidenceParent,
    `.flight-terminal-${da5V5FlightIdentity(bindingSetId, runNonce).runId}.pending`,
  );
}

function stageRoot(harness: Awaited<ReturnType<typeof createHarness>>): string {
  return join(
    harness.evidenceParent,
    `.flight-terminal-${da5V5FlightIdentity(bindingSetId, runNonce).runId}.stage`,
  );
}

function selectedFinalRoot(
  harness: Awaited<ReturnType<typeof createHarness>>,
  outcome: Da5V5TerminalOutcomeClass,
): string {
  return join(
    harness.evidenceParent,
    `flight-terminal-${da5V5FlightIdentity(bindingSetId, runNonce).runId}-${outcome}`,
  );
}

function expectTerminalOwnershipRestored(
  harness: Awaited<ReturnType<typeof createHarness>>,
): void {
  expect(harness.input.isRaw).toBe(false);
  expect(harness.input.isPaused()).toBe(true);
  expect(harness.input.listenerCount('data')).toBe(0);
  expect(harness.input.listenerCount('end')).toBe(0);
  expect(harness.input.listenerCount('close')).toBe(0);
  expect(harness.input.listenerCount('error')).toBe(0);
  expect(harness.output.listenerCount('error')).toBe(0);
  expect(harness.output.listenerCount('close')).toBe(0);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
  }
  throw new Error('condition not reached');
}

async function makeWritable(path: string): Promise<void> {
  const status = await stat(path).catch(() => null);
  if (status === null) return;
  if (!status.isDirectory()) {
    await chmod(path, 0o600);
    return;
  }
  await chmod(path, 0o700);
  for (const name of await readdir(path)) await makeWritable(join(path, name));
}

class FakeTtyInput extends EventEmitter {
  readonly isTTY = true;
  readonly readableEncoding = null;
  failPause = false;
  failRawRestore = false;
  failResume = false;
  isRaw = false;
  readableFlowing: boolean | null = null;
  private paused = true;

  isPaused(): boolean {
    return this.paused;
  }

  pause(): this {
    this.paused = true;
    this.readableFlowing = false;
    if (this.failPause) throw new Error('injected pause failure');
    return this;
  }

  resume(): this {
    this.paused = false;
    this.readableFlowing = true;
    if (this.failResume) throw new Error('injected resume failure');
    return this;
  }

  setRawMode(value: boolean): this {
    if (!value && this.failRawRestore) throw new Error('injected raw restore failure');
    this.isRaw = value;
    return this;
  }

  send(value: string): Buffer {
    const chunk = Buffer.from(value, 'utf8');
    this.emit('data', chunk);
    return chunk;
  }
}

class FakeOutput extends EventEmitter {
  readonly destroyed = false;
  readonly isTTY = true;
  readonly writableEnded = false;
  onWrite: (value: string, flush: (error?: Error) => void) => void = (_value, flush) => flush();
  private readonly chunks: string[] = [];

  constructor() {
    super();
  }

  text(): string {
    return this.chunks.join('');
  }

  write(value: string, callback: (error?: Error) => void): boolean {
    this.chunks.push(value);
    this.onWrite(value, callback);
    return true;
  }
}

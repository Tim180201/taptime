import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

import {
  DA5_V5_VALIDATION_PHASE0_ARTIFACT,
  createDa5V5ValidationPhase0Session,
} from './da5V5ValidationPhase0OperatorCore.mjs';
import {
  createDa5V5ValidationNoHardwareReadinessOptions,
  verifyDa5V5ValidationNoHardwareReadiness,
} from './da5V5ValidationNoHardwareReadiness.mjs';

const handledSignals = Object.freeze([
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
]);

export async function runDa5V5ValidationPhase0Operator(options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const environment = options.environment ?? process.env;
  const arguments_ = options.arguments_ ?? process.argv.slice(2);
  const processTarget = options.processTarget ?? process;
  const createSession =
    options.createSession ?? createDa5V5ValidationPhase0Session;
  const verifyReadiness = options.verifyReadiness
    ?? ((explicitEnvironment) =>
      verifyDa5V5ValidationNoHardwareReadiness(
        createDa5V5ValidationNoHardwareReadinessOptions(
          explicitEnvironment,
        ),
      ));
  let readiness;
  try {
    readiness = verifyReadiness(environment);
    if (
      readiness?.status !== 'match'
      || readiness.artifactSourceCommit
        !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit
      || readiness.artifactSourceTree
        !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree
    ) {
      throw new Error('DA5 V5 Validation readiness binding mismatch');
    }
  } catch {
    output.write(
      'da5_v5_validation_phase0 stage=readiness status=mismatch\n',
    );
    return Object.freeze({ status: 'mismatch' });
  }
  const session = createSession({
    androidBuild:
      environment.TAPTIME_DA5_V5_VALIDATION_ANDROID_BUILD,
    androidSdkAuthority: Object.freeze({
      androidHome: environment.ANDROID_HOME,
      androidSdkRoot: environment.ANDROID_SDK_ROOT,
    }),
    deviceModel:
      environment.TAPTIME_DA5_V5_VALIDATION_DEVICE_MODEL,
    profile:
      environment.TAPTIME_DA5_V5_VALIDATION_PHASE0_PROFILE,
    tools: Object.freeze({
      aapt: readiness.tools.aapt,
      adb: readiness.tools.adb,
      apksigner: readiness.tools.apksigner,
      hermesc: readiness.tools.hermesc,
      unzip: readiness.tools.unzip,
    }),
    receipt(stage, status, category) {
      output.write(
        `da5_v5_validation_phase0 stage=${stage} status=${status}`
        + `${category === undefined ? '' : ` category=${category}`}\n`,
      );
    },
  });
  const lineReader = createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input,
    terminal: false,
  });
  const onLine = (line) => {
    void session.submit(line);
  };
  const onClose = () => {
    void session.end();
  };
  let terminationFlight;
  const onSignal = () => {
    lineReader.pause();
    terminationFlight ??= session.signal();
  };
  const onFatal = () => {
    lineReader.pause();
    terminationFlight ??= session.fail();
  };
  lineReader.on('line', onLine);
  lineReader.once('close', onClose);
  for (const signal of handledSignals) {
    processTarget.on(signal, onSignal);
  }
  processTarget.on('uncaughtException', onFatal);
  processTarget.on('unhandledRejection', onFatal);
  if (arguments_.length !== 0) {
    void session.fail();
  } else {
    void session.start();
  }
  const result = await session.done;
  lineReader.removeListener('line', onLine);
  lineReader.removeListener('close', onClose);
  if (!lineReader.closed) lineReader.close();
  for (const signal of handledSignals) {
    processTarget.removeListener(signal, onSignal);
  }
  processTarget.removeListener('uncaughtException', onFatal);
  processTarget.removeListener('unhandledRejection', onFatal);
  return result;
}

if (
  process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await runDa5V5ValidationPhase0Operator();
  process.exitCode = result.status === 'match' ? 0 : 1;
}

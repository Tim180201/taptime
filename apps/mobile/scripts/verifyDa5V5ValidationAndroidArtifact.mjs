import {
  verifyDa5V5ValidationArtifactBinding,
} from './da5V5ValidationArtifact.mjs';
import {
  createDa5V5ValidationNoHardwareReadinessOptions,
  verifyDa5V5ValidationNoHardwareReadiness,
} from './da5V5ValidationNoHardwareReadiness.mjs';

const environment = process.env;
const options = {
  androidSdkAuthority: Object.freeze({
    androidHome: optional(environment, 'ANDROID_HOME'),
    androidSdkRoot: optional(environment, 'ANDROID_SDK_ROOT'),
  }),
  apk: fileBinding(environment, 'DA5_V5_VALIDATION_APK'),
  expectedSourceCommit: required(
    environment,
    'DA5_V5_VALIDATION_SOURCE_COMMIT',
  ),
  expectedSourceClosure: parseSourceClosure(
    required(environment, 'DA5_V5_VALIDATION_SOURCE_CLOSURE'),
  ),
  expectedSourceTree: required(
    environment,
    'DA5_V5_VALIDATION_SOURCE_TREE',
  ),
  manifest: fileBinding(environment, 'DA5_V5_VALIDATION_MANIFEST'),
};
const readiness = verifyDa5V5ValidationNoHardwareReadiness(
  createDa5V5ValidationNoHardwareReadinessOptions(environment),
);
if (
  readiness.artifactSourceCommit !== options.expectedSourceCommit
  || readiness.artifactSourceTree !== options.expectedSourceTree
) {
  throw new Error('DA5 V5 Validation artifact source binding mismatch');
}
verifyDa5V5ValidationArtifactBinding({
  ...options,
  inspectionTools: readiness.tools,
});
process.stdout.write('da5_v5_validation_artifact_verified\n');

function fileBinding(environment, prefix) {
  const bytes = Number(required(environment, `${prefix}_BYTES`));
  const mode = Number.parseInt(
    required(environment, `${prefix}_MODE`),
    8,
  );
  return Object.freeze({
    bytes,
    mode,
    path: required(environment, `${prefix}_PATH`),
    sha256: required(environment, `${prefix}_SHA256`),
  });
}

function required(environment, name) {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`DA5 V5 Validation required binding is missing: ${name}`);
  }
  return value;
}

function optional(environment, name) {
  const value = environment[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

function parseSourceClosure(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      'DA5 V5 Validation source closure binding is invalid',
    );
  }
}

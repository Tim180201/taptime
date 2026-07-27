import {
  verifyDa5V5ValidationArtifactBinding,
} from './da5V5ValidationArtifact.mjs';

const options = {
  apk: fileBinding('DA5_V5_VALIDATION_APK'),
  expectedSourceCommit: required('DA5_V5_VALIDATION_SOURCE_COMMIT'),
  expectedSourceClosure: parseSourceClosure(
    required('DA5_V5_VALIDATION_SOURCE_CLOSURE'),
  ),
  expectedSourceTree: required('DA5_V5_VALIDATION_SOURCE_TREE'),
  manifest: fileBinding('DA5_V5_VALIDATION_MANIFEST'),
};
verifyDa5V5ValidationArtifactBinding(options);
process.stdout.write('da5_v5_validation_artifact_verified\n');

function fileBinding(prefix) {
  const bytes = Number(required(`${prefix}_BYTES`));
  const mode = Number.parseInt(required(`${prefix}_MODE`), 8);
  return Object.freeze({
    bytes,
    mode,
    path: required(`${prefix}_PATH`),
    sha256: required(`${prefix}_SHA256`),
  });
}

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`DA5 V5 Validation required binding is missing: ${name}`);
  }
  return value;
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

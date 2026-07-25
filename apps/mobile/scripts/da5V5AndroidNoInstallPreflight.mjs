import {
  requireDa5V5AndroidProfile,
  verifyDa5V5AndroidArtifact,
} from './da5V5AndroidArtifact.mjs';

const profile = requireDa5V5AndroidProfile(process.env.TAPTIME_SYNTHETIC_E2E_PROFILE);
verifyDa5V5AndroidArtifact({ profile });
process.stdout.write('da5_v5_android_no_install_preflight=match\n');

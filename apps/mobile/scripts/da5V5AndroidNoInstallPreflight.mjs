import {
  requireDa5V5AndroidProfile,
  reverifyDa5V5AndroidArtifactForInstall,
  verifyDa5V5AndroidArtifact,
} from './da5V5AndroidArtifact.mjs';

const profile = requireDa5V5AndroidProfile(process.env.TAPTIME_SYNTHETIC_E2E_PROFILE);
const verification = verifyDa5V5AndroidArtifact({ profile });
const verifiedSource = reverifyDa5V5AndroidArtifactForInstall(verification);
verifiedSource.destroy();
process.stdout.write('da5_v5_android_no_install_preflight=match\n');

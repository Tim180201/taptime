import {
  SupabaseJwtAccessTokenVerifier,
  type AccessTokenVerifier,
} from '@taptime/backend-identity';
import { parseBootstrapCliArguments } from './cliArguments.js';
import {
  assertNoAmbientSecretConfiguration,
  assertOperatorPrincipal,
  loadBootstrapTargetProfile,
} from './databaseTarget.js';
import { OrganizationBootstrapCoordinator } from './OrganizationBootstrapCoordinator.js';
import {
  PostgresBootstrapCapability,
  type PostgresBootstrapCapabilityConfiguration,
} from './PostgresBootstrapCapability.js';
import {
  createProtectedSecretSource,
  type ProtectedSecretSource,
} from './protectedSecretInput.js';
import type { BootstrapCapability, BootstrapOrganizationResult } from './types.js';

export interface BootstrapCliDependencies {
  readonly loadProfile: typeof loadBootstrapTargetProfile;
  readonly createVerifier: (issuer: string) => AccessTokenVerifier;
  readonly createSecrets: (useStandardInput: boolean) => ProtectedSecretSource;
  readonly createCapability: (
    configuration: Omit<PostgresBootstrapCapabilityConfiguration, 'clientFactory'>,
  ) => BootstrapCapability;
}

const defaultDependencies: BootstrapCliDependencies = Object.freeze({
  loadProfile: loadBootstrapTargetProfile,
  createVerifier: (issuer: string) => SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['ES256', 'RS256'],
  }),
  createSecrets: (useStandardInput: boolean) => createProtectedSecretSource(useStandardInput),
  createCapability: (
    configuration: Omit<PostgresBootstrapCapabilityConfiguration, 'clientFactory'>,
  ) => new PostgresBootstrapCapability(configuration),
});

export async function runBootstrapCli(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
  output: NodeJS.WritableStream = process.stdout,
  dependencyOverrides: Partial<BootstrapCliDependencies> = {},
): Promise<number> {
  const dependencies = Object.freeze({ ...defaultDependencies, ...dependencyOverrides });
  let secrets: ProtectedSecretSource | undefined;
  try {
    assertNoAmbientSecretConfiguration(environment);
    const args = parseBootstrapCliArguments(argv);
    assertOperatorPrincipal(args.operatorPrincipal);
    const profile = await dependencies.loadProfile(args.profilePath);
    const verifier = dependencies.createVerifier(profile.supabaseIssuer);
    secrets = dependencies.createSecrets(args.secretsStdin);
    const accessToken = await secrets.readAccessToken();
    const capability = dependencies.createCapability({
      target: profile.database,
      operatorPrincipal: args.operatorPrincipal,
      passwordProvider: async () => {
        const password = await secrets!.readDatabasePassword();
        await secrets!.finish();
        return password;
      },
    });
    const result = await new OrganizationBootstrapCoordinator(verifier, capability).bootstrap({
      requestId: args.requestId,
      organizationDisplayName: args.organizationName,
      accessToken,
    });
    secrets.close();
    output.write(`${safeCliJson(result)}\n`);
    return exitCode(result);
  } catch {
    secrets?.close();
    output.write('{"status":"rejected","reason":"invalid_request"}\n');
    return 2;
  }
}

function safeCliJson(result: BootstrapOrganizationResult): string {
  if (result.status === 'succeeded') {
    return JSON.stringify(result);
  }
  if (result.status === 'unavailable') {
    return '{"status":"unavailable","reason":"service_unavailable"}';
  }
  return JSON.stringify({ status: 'rejected', reason: result.reason });
}

function exitCode(result: BootstrapOrganizationResult): number {
  if (result.status === 'succeeded') {
    return 0;
  }
  if (result.status === 'unavailable') {
    return 1;
  }
  if (result.reason === 'invalid_request') {
    return 2;
  }
  if (result.reason === 'access_token_rejected') {
    return 3;
  }
  return 4;
}

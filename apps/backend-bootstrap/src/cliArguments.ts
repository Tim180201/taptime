export interface BootstrapCliArguments {
  readonly profilePath: string;
  readonly operatorPrincipal: string;
  readonly requestId: string;
  readonly organizationName: string;
  readonly secretsStdin: boolean;
}

const valueOptions = new Map([
  ['--profile', 'profilePath'],
  ['--operator-login', 'operatorPrincipal'],
  ['--request-id', 'requestId'],
  ['--organization-name', 'organizationName'],
] as const);
type ValueOption = '--profile' | '--operator-login' | '--request-id' | '--organization-name';

export function parseBootstrapCliArguments(argv: readonly string[]): BootstrapCliArguments {
  const values = new Map<string, string>();
  let secretsStdin = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === '--secrets-stdin') {
      if (secretsStdin) {
        throw new Error('invalid_arguments');
      }
      secretsStdin = true;
      continue;
    }
    const property = valueOptions.get(argument as ValueOption);
    const next = argv[index + 1];
    if (property === undefined || next === undefined || next.startsWith('--') || values.has(property)) {
      throw new Error('invalid_arguments');
    }
    values.set(property, next);
    index += 1;
  }
  if (values.size !== valueOptions.size) {
    throw new Error('invalid_arguments');
  }
  return Object.freeze({
    profilePath: values.get('profilePath')!,
    operatorPrincipal: values.get('operatorPrincipal')!,
    requestId: values.get('requestId')!,
    organizationName: values.get('organizationName')!,
    secretsStdin,
  });
}

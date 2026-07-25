export const DA5_V5_ADB_SERVER_SOCKET: 'tcp:127.0.0.1:5037';

export function createDa5V5AdbChildEnvironment(
  environment?: Readonly<Record<string, string | undefined>>,
): Readonly<{
  ADB_SERVER_SOCKET: typeof DA5_V5_ADB_SERVER_SOCKET;
  PATH: string;
}>;

export const DA5_V5_ADB_SERVER_SOCKET = 'tcp:127.0.0.1:5037';

export function createDa5V5AdbChildEnvironment(environment = process.env) {
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined && isAdbOverride(name)) {
      throw new Error('DA5 V5 ADB routing environment override is forbidden');
    }
  }
  const path = environment.PATH;
  if (
    typeof path !== 'string'
    || path.length === 0
    || path.includes('\0')
    || path.includes('\r')
    || path.includes('\n')
  ) {
    throw new Error('DA5 V5 ADB child PATH is unavailable');
  }
  return Object.freeze({
    ADB_SERVER_SOCKET: DA5_V5_ADB_SERVER_SOCKET,
    PATH: path,
  });
}

function isAdbOverride(name) {
  return name === 'ANDROID_SERIAL'
    || name.startsWith('ADB_')
    || name.startsWith('ANDROID_ADB_');
}

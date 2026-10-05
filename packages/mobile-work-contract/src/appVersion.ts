export const APP_VERSION_HEADER = 'X-TapTime-App';
export const MOBILE_SESSION_V2 = 'application/vnd.taptime.mobile-session.v2+json';
export const MOBILE_SESSION_V3 = 'application/vnd.taptime.mobile-session.v3+json';
export const APP_UPDATE_MESSAGE = 'Bitte App aktualisieren';
export interface AppVersion { readonly platform: 'ios' | 'android'; readonly build: number; readonly commit: string }
export function encodeAppVersion(version: AppVersion): string {
  return `v1;${version.platform};${version.build};${version.commit}`;
}
export function parseAppVersion(value: string): AppVersion | null {
  const match = /^v1;(ios|android);(0|[1-9][0-9]{0,9});([0-9a-f]{40}|development)$/.exec(value);
  if (!match) return null;
  return { platform: match[1] as AppVersion['platform'], build: Number(match[2]), commit: match[3]! };
}

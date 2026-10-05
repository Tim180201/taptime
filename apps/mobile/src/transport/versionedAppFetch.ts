import { APP_VERSION_HEADER, encodeAppVersion, type AppVersion } from '@taptime/mobile-work-contract';

/** The product API's transport boundary; Supabase keeps its own transport. */
export function versionedAppFetch(send: typeof fetch, version: AppVersion,
  updateRequired: (accessToken: string) => void): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(APP_VERSION_HEADER, encodeAppVersion(version));
    const response = await send(input, { ...init, headers });
    if (response.status === 426) {
      const token = headers.get('Authorization')?.replace(/^Bearer /i, '');
      if (token) updateRequired(token);
    }
    return response;
  };
}

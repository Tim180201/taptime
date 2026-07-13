export interface ProductRuntimeEnvironment {
  readonly supabaseUrl: string | undefined;
  readonly supabasePublishableKey: string | undefined;
  readonly tapTimeApiBaseUrl: string | undefined;
}

export interface ProductRuntimeConfiguration {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly tapTimeApiBaseUrl: string;
}

export type ProductRuntimeConfigurationResult =
  | { readonly status: 'valid'; readonly configuration: ProductRuntimeConfiguration }
  | { readonly status: 'invalid' };

export function readProductRuntimeEnvironment(): ProductRuntimeEnvironment {
  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    tapTimeApiBaseUrl: process.env.EXPO_PUBLIC_TAPTIME_API_BASE_URL,
  };
}

export function validateProductRuntimeConfiguration(
  environment: ProductRuntimeEnvironment,
  platform: string,
): ProductRuntimeConfigurationResult {
  if (platform !== 'android' && platform !== 'ios') {
    return { status: 'invalid' };
  }

  const supabaseUrl = validatePublicHttpsUrl(environment.supabaseUrl);
  const tapTimeApiBaseUrl = validatePublicHttpsUrl(environment.tapTimeApiBaseUrl);
  const publishableKey = environment.supabasePublishableKey;
  if (
    supabaseUrl === null
    || tapTimeApiBaseUrl === null
    || publishableKey === undefined
    || publishableKey.trim() !== publishableKey
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)
  ) {
    return { status: 'invalid' };
  }

  return {
    status: 'valid',
    configuration: Object.freeze({
      supabaseUrl: supabaseUrl.href,
      supabasePublishableKey: publishableKey,
      tapTimeApiBaseUrl: tapTimeApiBaseUrl.href,
    }),
  };
}

function validatePublicHttpsUrl(value: string | undefined): URL | null {
  if (value === undefined || value.trim() !== value || value.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.username.length > 0
    || url.password.length > 0
    || url.search.length > 0
    || url.hash.length > 0
    || url.hostname.length === 0
  ) {
    return null;
  }
  if (url.protocol === 'https:') {
    return url;
  }
  return url.protocol === 'http:' && isNumericLoopbackHost(url.hostname) ? url : null;
}

function isNumericLoopbackHost(hostname: string): boolean {
  const normalized = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (normalized === '::1') {
    return true;
  }
  const octets = normalized.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

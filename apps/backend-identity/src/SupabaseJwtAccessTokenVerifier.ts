import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import type {
  AccessTokenVerificationRejectionReason,
  AccessTokenVerificationResult,
  AccessTokenVerifier,
  AllowedAsymmetricJwtAlgorithm,
} from './accessToken.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeAsymmetricAlgorithms = new Set<AllowedAsymmetricJwtAlgorithm>(['ES256', 'RS256']);

export interface SupabaseJwtAccessTokenVerifierConfiguration {
  readonly issuer: string;
  readonly allowedAlgorithms: readonly AllowedAsymmetricJwtAlgorithm[];
}

export interface SupabaseRemoteJwtAccessTokenVerifierConfiguration
  extends SupabaseJwtAccessTokenVerifierConfiguration {
  readonly jwksUrl: URL;
}

export class AccessTokenVerificationInfrastructureError extends Error {
  constructor(cause: unknown) {
    super('Access-token verification infrastructure is unavailable', { cause });
    this.name = 'AccessTokenVerificationInfrastructureError';
  }
}

export class SupabaseJwtAccessTokenVerifier implements AccessTokenVerifier {
  private static readonly audience = 'authenticated';
  private readonly issuer: string;
  private readonly allowedAlgorithms: readonly AllowedAsymmetricJwtAlgorithm[];

  private constructor(
    configuration: SupabaseJwtAccessTokenVerifierConfiguration,
    private readonly verificationKey: JWTVerifyGetKey,
  ) {
    if (configuration.issuer.trim().length === 0) {
      throw new Error('Supabase JWT issuer must be non-empty');
    }
    const algorithms = [...new Set(configuration.allowedAlgorithms)];
    if (algorithms.length === 0) {
      throw new Error('At least one asymmetric JWT algorithm must be allowed');
    }
    if (algorithms.some((algorithm) => !safeAsymmetricAlgorithms.has(algorithm))) {
      throw new Error('Only ES256 and RS256 are supported for Supabase JWT verification');
    }
    this.issuer = configuration.issuer;
    this.allowedAlgorithms = Object.freeze(algorithms);
  }

  static fromRemoteJwks(
    configuration: SupabaseRemoteJwtAccessTokenVerifierConfiguration,
  ): SupabaseJwtAccessTokenVerifier {
    const expectedJwksUrl = jwksUrlForIssuer(configuration.issuer);
    if (configuration.jwksUrl.href !== expectedJwksUrl.href) {
      throw new Error(
        `Supabase JWKS URL must match the configured issuer: ${expectedJwksUrl.href}`,
      );
    }
    return new SupabaseJwtAccessTokenVerifier(
      configuration,
      createRemoteJWKSet(configuration.jwksUrl),
    );
  }

  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    let protectedHeader: ReturnType<typeof decodeProtectedHeader>;
    try {
      protectedHeader = decodeProtectedHeader(accessToken);
    } catch {
      return { status: 'rejected', reason: 'malformed_token' };
    }

    if (protectedHeader.typ !== 'JWT') {
      return { status: 'rejected', reason: 'unsuitable_token' };
    }
    if (!this.allowedAlgorithms.includes(protectedHeader.alg as AllowedAsymmetricJwtAlgorithm)) {
      return { status: 'rejected', reason: 'unsupported_algorithm' };
    }

    try {
      const { payload } = await jwtVerify(accessToken, this.verificationKey, {
        algorithms: [...this.allowedAlgorithms],
        audience: SupabaseJwtAccessTokenVerifier.audience,
        issuer: this.issuer,
        requiredClaims: [
          'aal',
          'email',
          'exp',
          'iat',
          'is_anonymous',
          'phone',
          'role',
          'session_id',
          'sub',
        ],
      });

      if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
        return { status: 'rejected', reason: 'subject_missing' };
      }
      if (
        payload.role !== 'authenticated'
        || payload.is_anonymous !== false
        || (payload.aal !== 'aal1' && payload.aal !== 'aal2')
        || typeof payload.session_id !== 'string'
        || !uuidPattern.test(payload.session_id)
        || typeof payload.email !== 'string'
        || typeof payload.phone !== 'string'
      ) {
        return { status: 'rejected', reason: 'unsuitable_token' };
      }

      return {
        status: 'verified',
        identity: Object.freeze({ issuer: this.issuer, subject: payload.sub }),
      };
    } catch (error) {
      const reason = rejectionReason(error);
      if (reason !== null) {
        return { status: 'rejected', reason };
      }
      throw new AccessTokenVerificationInfrastructureError(error);
    }
  }
}

function jwksUrlForIssuer(issuer: string): URL {
  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    throw new Error('Supabase JWT issuer must be an absolute URL');
  }
  if (
    issuerUrl.username.length > 0
    || issuerUrl.password.length > 0
    || issuerUrl.search.length > 0
    || issuerUrl.hash.length > 0
  ) {
    throw new Error('Supabase JWT issuer must not contain credentials, query, or fragment');
  }
  if (
    issuerUrl.protocol !== 'https:'
    && !(issuerUrl.protocol === 'http:' && isNumericLoopbackHost(issuerUrl.hostname))
  ) {
    throw new Error(
      'Supabase JWT issuer must use HTTPS; HTTP is allowed only for numeric loopback test infrastructure',
    );
  }
  const issuerWithoutTrailingSlash = issuerUrl.href.replace(/\/+$/, '');
  return new URL(`${issuerWithoutTrailingSlash}/.well-known/jwks.json`);
}

function isNumericLoopbackHost(hostname: string): boolean {
  if (hostname === '[::1]') {
    return true;
  }
  const octets = hostname.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function rejectionReason(error: unknown): AccessTokenVerificationRejectionReason | null {
  if (error instanceof errors.JWTExpired) {
    return 'token_expired';
  }
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === 'iss') {
      return 'issuer_mismatch';
    }
    if (error.claim === 'aud') {
      return 'audience_mismatch';
    }
    if (error.claim === 'nbf') {
      return 'token_not_active';
    }
    if (error.claim === 'sub') {
      return 'subject_missing';
    }
    return 'unsuitable_token';
  }
  if (
    error instanceof errors.JWSSignatureVerificationFailed
    || (error instanceof Error && error.name === 'JWKSNoMatchingKey')
  ) {
    return 'invalid_signature';
  }
  if (
    error instanceof errors.JWSInvalid
    || error instanceof errors.JWTInvalid
    || error instanceof errors.JOSEAlgNotAllowed
    || error instanceof errors.JOSENotSupported
  ) {
    return 'malformed_token';
  }
  return null;
}

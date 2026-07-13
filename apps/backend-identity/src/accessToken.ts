export type AllowedAsymmetricJwtAlgorithm = 'ES256' | 'RS256';

export interface VerifiedProviderIdentity {
  readonly issuer: string;
  readonly subject: string;
}

export type AccessTokenVerificationRejectionReason =
  | 'audience_mismatch'
  | 'invalid_signature'
  | 'issuer_mismatch'
  | 'malformed_token'
  | 'subject_missing'
  | 'token_expired'
  | 'token_not_active'
  | 'unsuitable_token'
  | 'unsupported_algorithm';

export type AccessTokenVerificationResult =
  | {
      readonly status: 'verified';
      readonly identity: VerifiedProviderIdentity;
    }
  | {
      readonly status: 'rejected';
      readonly reason: AccessTokenVerificationRejectionReason;
    };

export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<AccessTokenVerificationResult>;
}

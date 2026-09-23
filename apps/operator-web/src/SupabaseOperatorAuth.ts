import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  OperatorError,
  type OperatorAuth,
  type MfaFactor,
} from "./OperatorRuntime";
const STORAGE_KEY = "taptime-operator-auth";
export function readConfiguration(env: Record<string, unknown>) {
  const url = env.VITE_TAPTIME_SUPABASE_URL,
    key = env.VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY;
  if (
    typeof url !== "string" ||
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ||
    typeof key !== "string" ||
    !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)
  )
    return null;
  return { url, key };
}
export class SupabaseOperatorAuth implements OperatorAuth {
  private client: SupabaseClient;
  private authWork: Promise<unknown> = Promise.resolve();
  // Supabase persists successful MFA responses before resolving. Logout must run
  // after any such write, including a response received after the UI was cleared.
  private mutate<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.authWork.then(work);
    this.authWork = pending.catch(() => {});
    return pending;
  }
  constructor(
    url: string,
    key: string,
    private storage: Storage,
  ) {
    this.client = createClient(url, key, {
      auth: {
        storage,
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  async getAccessToken() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new OperatorError("unauthorized");
    return data.session?.access_token ?? null;
  }
  async signIn(email: string, password: string) {
    return this.mutate(async () => {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const mapping: Record<string, string> = {
          invalid_credentials: "credentials_rejected",
          email_not_confirmed: "email_not_confirmed",
          user_banned: "forbidden",
          over_request_rate_limit: "rate_limited",
        };
        throw new OperatorError(
          error.status === 429
            ? "rate_limited"
            : (mapping[error.code ?? ""] ?? "service_unavailable"),
        );
      }
      if (!data.session) throw new OperatorError("service_unavailable");
    });
  }
  async signOut() {
    return this.mutate(async () => {
      try {
        await this.client.auth.signOut({ scope: "local" });
      } catch {
        /* Local logout still removes persisted credentials. */
      } finally {
        this.storage.removeItem(STORAGE_KEY);
        this.storage.removeItem(`${STORAGE_KEY}-code-verifier`);
      }
    });
  }
  onSignedOut(callback: () => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") callback();
    });
    return () => data.subscription.unsubscribe();
  }
  async prepareMfa(): Promise<MfaFactor> {
    return this.mutate(async () => {
      const { data, error } = await this.client.auth.mfa.listFactors();
      if (error) throw new OperatorError("service_unavailable");
      const verified = data.all.find(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "verified",
      );
      if (verified) return { factorId: verified.id };
      // Only abandoned TOTP enrollments are removed. A verified factor is never replaced.
      for (const factor of data.all.filter(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "unverified",
      )) {
        const removed = await this.client.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (removed.error) throw new OperatorError("service_unavailable");
      }
      const enrollment = await this.client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Taptura Betreiber",
      });
      if (enrollment.error) throw new OperatorError("service_unavailable");
      return {
        factorId: enrollment.data.id,
        qrCode: enrollment.data.totp.qr_code,
        secret: enrollment.data.totp.secret,
      };
    });
  }
  async verifyMfa(factorId: string, code: string) {
    return this.mutate(async () => {
      const result = await this.client.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (result?.error) throw new OperatorError("mfa_invalid");
    });
  }
}

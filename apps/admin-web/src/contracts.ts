export interface SafeProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly customers: readonly { readonly id: string; readonly displayName: string; readonly active: boolean }[];
  readonly nfcTags: readonly { readonly id: string; readonly displayName: string; readonly validationFingerprint: string; readonly assignmentState: 'assigned' | 'unassigned'; readonly targetCustomerId: string | null }[];
  readonly nextCursor: string | null;
}
export type AdminWebState =
  | { readonly status: 'signed_out' }
  | { readonly status: 'signing_in' }
  | { readonly status: 'loading' }
  | { readonly status: 'forbidden'; readonly message: string }
  | { readonly status: 'unavailable'; readonly message: string }
  | { readonly status: 'ready'; readonly projection: SafeProjection; readonly creating: boolean; readonly notice: string | null };
export interface AdminWebCapability {
  getState(): AdminWebState;
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  createCustomer(displayName: string): Promise<void>;
}

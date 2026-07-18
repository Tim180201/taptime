export interface SafeProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly customers: readonly { readonly id: string; readonly displayName: string; readonly active: boolean }[];
  readonly nfcTags: readonly { readonly id: string; readonly displayName: string; readonly validationFingerprint: string; readonly assignmentState: 'assigned' | 'unassigned'; readonly targetCustomerId: string | null; readonly activeAssignmentId: string | null }[];
  readonly nextCursor: string | null;
}
export interface SafeEmployeeProjection {
  readonly organization: { readonly id: string; readonly name: string };
  readonly employeeMemberships: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly role: 'employee';
    readonly active: true;
  }[];
  readonly nextCursor: string | null;
}
export interface VolatileInvitationSecret {
  readonly value: string;
  readonly expiresAt: string;
}
export interface ReassignmentIntent {
  readonly commandId: string;
  readonly nfcTagId: string;
  readonly expectedActiveAssignmentId: string;
  readonly targetCustomerId: string;
}
export type AdminWebState =
  | { readonly status: 'signed_out' }
  | { readonly status: 'signing_in' }
  | { readonly status: 'loading' }
  | { readonly status: 'forbidden'; readonly message: string }
  | { readonly status: 'unavailable'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly projection: SafeProjection;
      readonly employeeProjection: SafeEmployeeProjection;
      readonly creating: boolean;
      readonly creatingEmployee: boolean;
      readonly invitation: VolatileInvitationSecret | null;
      readonly reassignmentIntent: ReassignmentIntent | null;
      readonly reassigning: boolean;
      readonly notice: string | null;
    };
export interface AdminWebCapability {
  getState(): AdminWebState;
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  createCustomer(displayName: string): Promise<void>;
  createEmployeeInvitation(displayName: string): Promise<void>;
  loadMoreEmployees(): Promise<void>;
  dismissInvitation(): void;
  prepareReassignment(nfcTagId: string, targetCustomerId: string): void;
  cancelReassignment(): void;
  confirmReassignment(): Promise<void>;
}

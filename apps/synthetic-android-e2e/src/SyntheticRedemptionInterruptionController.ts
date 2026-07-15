import type { EmployeeMembershipEnrollmentCoordinator as EmployeeEnrollmentPort } from '@taptime/backend-api';
import {
  EmployeeMembershipEnrollmentCoordinator,
  type CreateEmployeeMembershipInvitationCommand,
  type CreateEmployeeMembershipInvitationResult,
  type EmployeeEnrollmentCoordinatorControls,
  type ReadEmployeeMembershipsProjectionCommand,
  type ReadEmployeeMembershipsProjectionResult,
  type RedeemEmployeeMembershipInvitationCommand,
  type RedeemEmployeeMembershipInvitationResult,
} from '@taptime/backend-administration';

export type SyntheticRedemptionInterruptionEvent =
  | 'redemption_interruption_armed'
  | 'redemption_interrupted'
  | 'redemption_paused';

export type SyntheticRedemptionInterruptionState = 'armed' | 'disarmed' | 'paused';

const automaticAbortMilliseconds = 8_000;

/** Strictly local fault injection at the real coordinator's final pre-commit boundary. */
export class SyntheticRedemptionInterruptionController implements EmployeeEnrollmentPort {
  private state: SyntheticRedemptionInterruptionState = 'disarmed';
  private pendingRejection: ((error: Error) => void) | null = null;
  private automaticAbort: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly delegate: EmployeeMembershipEnrollmentCoordinator,
    private readonly onSafeEvent: (event: SyntheticRedemptionInterruptionEvent) => void,
  ) {}

  createInvitation(
    command: CreateEmployeeMembershipInvitationCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<CreateEmployeeMembershipInvitationResult> {
    return this.delegate.createInvitation(command, controls);
  }

  readEmployeeMembershipsProjection(
    command: ReadEmployeeMembershipsProjectionCommand,
    controls?: EmployeeEnrollmentCoordinatorControls,
  ): Promise<ReadEmployeeMembershipsProjectionResult> {
    return this.delegate.readEmployeeMembershipsProjection(command, controls);
  }

  redeemInvitation(
    command: RedeemEmployeeMembershipInvitationCommand,
    controls: EmployeeEnrollmentCoordinatorControls = {},
  ): Promise<RedeemEmployeeMembershipInvitationResult> {
    return this.delegate.redeemInvitation(command, {
      ...controls,
      beforeCommit: async () => {
        await controls.beforeCommit?.();
        await this.pauseIfArmed();
      },
    });
  }

  armNextRedemptionInterruption(): void {
    if (this.state !== 'disarmed') {
      throw new Error('Synthetic redemption interruption is already active');
    }
    this.state = 'armed';
    try {
      this.onSafeEvent('redemption_interruption_armed');
    } catch (error) {
      this.state = 'disarmed';
      throw error;
    }
  }

  abortPausedRedemption(): void {
    if (this.state !== 'paused' || this.pendingRejection === null) {
      throw new Error('No synthetic redemption is paused');
    }
    const reject = this.pendingRejection;
    this.pendingRejection = null;
    this.clearAutomaticAbort();
    this.state = 'disarmed';
    reject(new Error('Synthetic C3E1 redemption interrupted before commit'));
    this.onSafeEvent('redemption_interrupted');
  }

  getState(): SyntheticRedemptionInterruptionState {
    return this.state;
  }

  close(): void {
    if (this.state === 'paused' && this.pendingRejection !== null) {
      this.abortPausedRedemption();
      return;
    }
    this.clearAutomaticAbort();
    this.state = 'disarmed';
  }

  private async pauseIfArmed(): Promise<void> {
    if (this.state !== 'armed') {
      return;
    }
    this.state = 'paused';
    const paused = new Promise<void>((_resolve, reject) => {
      this.pendingRejection = reject;
      this.automaticAbort = setTimeout(() => {
        if (this.state === 'paused') {
          this.abortPausedRedemption();
        }
      }, automaticAbortMilliseconds);
    });
    try {
      this.onSafeEvent('redemption_paused');
    } catch (error) {
      this.pendingRejection = null;
      this.clearAutomaticAbort();
      this.state = 'disarmed';
      throw error;
    }
    await paused;
  }

  private clearAutomaticAbort(): void {
    if (this.automaticAbort !== null) {
      clearTimeout(this.automaticAbort);
      this.automaticAbort = null;
    }
  }
}

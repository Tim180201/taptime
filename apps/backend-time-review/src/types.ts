import type {
  ReviewAdjudicationRequest,
  ReviewAdjudicationReceipt,
  ReviewItemQueryPage,
  ReviewItemQueryRequest,
  TimeRecordCorrectionRequest,
  TimeRecordQueryPage,
  TimeRecordQueryRequest,
  TimeReviewReadResult,
  TimeReviewWriteResult,
  CorrectedTimeRecord,
} from '@taptime/time-review-contract';

export interface AuthenticatedTimeReviewCommand<T> {
  readonly accessToken: string;
  readonly request: T;
}

export interface TimeReviewCoordinatorControls {
  readonly deadlineEpochMilliseconds?: number;
  readonly afterAuthorityLocked?: () => void | Promise<void>;
  readonly beforeCommit?: () => void | Promise<void>;
}

export interface TimeReviewPort {
  queryTimeRecords(
    command: AuthenticatedTimeReviewCommand<TimeRecordQueryRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewReadResult<TimeRecordQueryPage>>;

  correctTimeRecord(
    command: AuthenticatedTimeReviewCommand<TimeRecordCorrectionRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewWriteResult<CorrectedTimeRecord>>;

  queryReviewItems(
    command: AuthenticatedTimeReviewCommand<ReviewItemQueryRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewReadResult<ReviewItemQueryPage>>;

  adjudicateReviewItems(
    command: AuthenticatedTimeReviewCommand<ReviewAdjudicationRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewWriteResult<ReviewAdjudicationReceipt>>;
}

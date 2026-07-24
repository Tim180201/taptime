import type {
  ReviewAdjudicationRequest,
  ReviewAdjudicationReceipt,
  ReviewItemQueryPage,
  ReviewItemQueryRequest,
  TimeRecordCorrectionRequest,
  TimeRecordQueryPage,
  TimeRecordQueryPageV2,
  TimeRecordQueryRequest,
  TimeReviewReadResult,
  TimeReviewWriteResult,
  CorrectedTimeRecord,
  ReviewItemQueryPageV2,
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
  readonly queryTimeRecordsV2?: (
    command: AuthenticatedTimeReviewCommand<TimeRecordQueryRequest>,
    controls?: TimeReviewCoordinatorControls,
  ) => Promise<TimeReviewReadResult<TimeRecordQueryPageV2>>;

  correctTimeRecord(
    command: AuthenticatedTimeReviewCommand<TimeRecordCorrectionRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewWriteResult<CorrectedTimeRecord>>;

  queryReviewItems(
    command: AuthenticatedTimeReviewCommand<ReviewItemQueryRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewReadResult<ReviewItemQueryPage>>;
  readonly queryReviewItemsV2?: (
    command: AuthenticatedTimeReviewCommand<ReviewItemQueryRequest>,
    controls?: TimeReviewCoordinatorControls,
  ) => Promise<TimeReviewReadResult<ReviewItemQueryPageV2>>;

  adjudicateReviewItems(
    command: AuthenticatedTimeReviewCommand<ReviewAdjudicationRequest>,
    controls?: TimeReviewCoordinatorControls,
  ): Promise<TimeReviewWriteResult<ReviewAdjudicationReceipt>>;
}

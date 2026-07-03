export * from './domain/ids';
export * from './domain/NfcPayload';
export * from './domain/Timestamp';
export * from './domain/CallerContext';
export * from './domain/AssignmentTarget';
export * from './domain/Customer';
export * from './domain/NfcTag';
export * from './domain/NfcAssignment';
export * from './domain/facts/NfcTagScanned';
export * from './domain/events/NfcAssignmentResolution';

export * from './ports/NfcScanPort';
export * from './ports/NfcTagRepository';
export * from './ports/NfcAssignmentRepository';
export * from './ports/CustomerRepository';
export * from './ports/WorkEventCreationPort';

export * from './business/AssignmentResolver';
export * from './business/AssignmentValidator';
export * from './business/AssignmentValidationResult';

export * from './application/NfcScanApplicationService';
export * from './application/ScanPipelineOutcome';

export * from './infrastructure/adapters/FakeNfcScanAdapter';
export * from './infrastructure/repositories/InMemoryNfcTagRepository';
export * from './infrastructure/repositories/InMemoryNfcAssignmentRepository';
export * from './infrastructure/repositories/InMemoryCustomerRepository';

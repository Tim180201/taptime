export class OperatorError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

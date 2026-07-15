export type ErrorDetails = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: ErrorDetails | null = null,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(details: ErrorDetails) {
    super(400, "VALIDATION_ERROR", "Du lieu khong hop le", details);
  }
}

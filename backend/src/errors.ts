export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isUniqueViolation = (error: unknown, constraint: string) =>
  error instanceof Error &&
  "code" in error &&
  error.code === "23505" &&
  "constraint" in error &&
  error.constraint === constraint;

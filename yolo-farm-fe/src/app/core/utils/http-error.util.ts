import { HttpErrorResponse } from '@angular/common/http';

export function extractApiErrorMessage(
  error: unknown,
  fallback = 'Unexpected error. Please try again.'
): string {
  if (error instanceof HttpErrorResponse) {
    const payload = error.error as { message?: string } | null;
    return payload?.message ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

import { HttpErrorResponse } from '@angular/common/http';

export interface ExtractErrorOptions {
  allowErrorMessage?: boolean;
  allowMessageField?: boolean;
}

interface ErrorResponse {
  error?: string;
  details?: unknown;
}

const extractNestedError = (error: unknown): string | null => {
  if (!error || typeof error !== 'object' || !('error' in error)) {
    return null;
  }

  const nested = (error as { error?: { error?: string } | string }).error;
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
    return nested.error;
  }

  return null;
};

const extractMessageField = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const directMessage = (error as { message?: unknown }).message;
  if (typeof directMessage === 'string' && directMessage) {
    return directMessage;
  }

  const nested = (error as { error?: unknown }).error;
  if (nested && typeof nested === 'object') {
    const nestedMessage = (nested as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage) {
      return nestedMessage;
    }
  }

  return null;
};

export const extractErrorMessage = (
  error: unknown,
  fallback: string,
  options: ExtractErrorOptions = {}
): string => {
  const nestedError = extractNestedError(error);
  if (nestedError) return nestedError;

  if (options.allowMessageField) {
    const messageField = extractMessageField(error);
    if (messageField) return messageField;
  }

  if (options.allowErrorMessage && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof HttpErrorResponse) {
    const data = error.error as ErrorResponse | string | null;
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object' && data.error) {
      return data.error;
    }
    if (error.status === 0) {
      return 'Unable to reach the server. Please try again.';
    }
    return error.message || 'Request failed. Please try again.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

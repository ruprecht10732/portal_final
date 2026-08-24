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
  if (!error || typeof error !== 'object') return null;

  const obj = error as Record<string, unknown>;
  const nested = obj['error'];
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object') {
    const deep = (nested as Record<string, unknown>)['error'];
    if (typeof deep === 'string') return deep;
  }

  return null;
};

const extractMessageField = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;

  const obj = error as Record<string, unknown>;
  const msg = obj['message'];
  if (typeof msg === 'string' && msg.length > 0) return msg;

  const nested = obj['error'];
  if (nested && typeof nested === 'object') {
    const nestedMsg = (nested as Record<string, unknown>)['message'];
    if (typeof nestedMsg === 'string' && nestedMsg.length > 0) return nestedMsg;
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

export const sanitizeRawError = (message: string): string => {
  if (!message) return 'Something went wrong. Please try again.';
  const lower = message.toLowerCase().trim();

  if (lower.includes('duplicate key') || lower.includes('23505') || lower.includes('unique constraint')) {
    if (lower.includes('email')) {
      return 'An account with this email already exists.';
    }
    return 'A record with these details already exists.';
  }
  if (lower.includes('foreign key') || lower.includes('23503')) {
    return 'The referenced item does not exist.';
  }
  if (lower.includes('sqlstate') || lower.includes('relation ') || lower.includes('syntax error')) {
    return 'A database error occurred. Please try again.';
  }
  if (lower === 'forbidden') {
    return 'You do not have permission to perform this action.';
  }
  if (lower === 'organization required') {
    return 'An organization is required. Please complete onboarding.';
  }
  return message;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof HttpErrorResponse) {
    const data = error.error as ErrorResponse | string | null;
    if (typeof data === 'string') {
      return sanitizeRawError(data);
    }
    if (data && typeof data === 'object' && data.error) {
      return sanitizeRawError(data.error);
    }
    if (error.status === 0) {
      return 'Unable to reach the server. Please check your connection.';
    }
    return sanitizeRawError(error.message || 'Request failed. Please try again.');
  }

  if (error instanceof Error) {
    return sanitizeRawError(error.message);
  }

  return 'Something went wrong. Please try again.';
};

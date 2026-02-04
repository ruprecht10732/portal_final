export interface ExtractErrorOptions {
  allowErrorMessage?: boolean;
  allowMessageField?: boolean;
}

export const extractErrorMessage = (
  error: unknown,
  fallback: string,
  options: ExtractErrorOptions = {}
): string => {
  if (error && typeof error === 'object' && 'error' in error) {
    const nested = (error as { error?: { error?: string } | string }).error;
    if (typeof nested === 'string') return nested;
    if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
      return nested.error;
    }
  }

  if (options.allowMessageField && error && typeof error === 'object') {
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
  }

  if (options.allowErrorMessage && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

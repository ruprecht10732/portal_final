import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ToastService, ToastVariant } from './toast.service';

export interface ErrorContext {
  source?: 'http' | 'runtime' | 'manual';
  status?: number;
  url?: string;
  silent?: boolean;
  userMessage?: string;
}

interface NormalizedError {
  message: string;
  variant: ToastVariant;
  status?: number | undefined;
  url?: string | undefined;
}

@Injectable({ providedIn: 'root' })
export class ErrorReportingService {
  private readonly toasts = inject(ToastService);

  report(error: unknown, context: ErrorContext = {}): void {
    const normalized = this.normalize(error, context);

    console.error('[ClientError]', {
      message: normalized.message,
      status: normalized.status,
      url: normalized.url,
      source: context.source,
      originalError: error,
    });

    if (!context.silent) {
      this.toasts.show({
        message: normalized.message,
        variant: normalized.variant,
      });
    }
  }

  private normalize(error: unknown, context: ErrorContext): NormalizedError {
    if (context.userMessage) {
      return {
        message: context.userMessage,
        variant: 'error',
        status: context.status,
        url: context.url,
      };
    }

    if (error instanceof HttpErrorResponse) {
      const message = this.getHttpMessage(error);
      const variant = error.status >= 500 || error.status === 0 ? 'error' : 'warning';
      return {
        message,
        variant,
        status: error.status,
        url: error.url ?? context.url,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message || 'Something went wrong. Please try again.',
        variant: 'error',
        status: context.status,
        url: context.url,
      };
    }

    return {
      message: 'Something went wrong. Please try again.',
      variant: 'error',
      status: context.status,
      url: context.url,
    };
  }

  private getHttpMessage(error: HttpErrorResponse): string {
    const data = error.error as { error?: string; message?: string } | string | null;
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object') {
      return data.error || data.message || error.message || 'Request failed. Please try again.';
    }
    if (error.status === 0) {
      return 'Unable to reach the server. Please check your connection.';
    }
    return error.message || 'Request failed. Please try again.';
  }
}

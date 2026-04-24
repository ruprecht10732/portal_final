import { DestroyRef, WritableSignal } from '@angular/core';
import { EMPTY, MonoTypeOperatorFunction, OperatorFunction, catchError, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorContext, ErrorReportingService } from '../services/error-reporting.service';
import { ToastService } from '../services/toast.service';
import { getAuthErrorMessage } from './auth-error-mapper';

export type ErrorMessageResolver = (error: unknown) => string;

export interface SubmitStateOptions {
  loading: WritableSignal<boolean>;
  error?: WritableSignal<string>;
  reporter: ErrorReportingService;
  getMessage: ErrorMessageResolver;
  reportContext?: ErrorContext;
}

export const handleSubmitState = <T>(options: SubmitStateOptions): OperatorFunction<T, T> => {
  return (source) =>
    source.pipe(
      catchError(error => {
        const message = options.getMessage(error);
        options.error?.set(message);
        options.reporter.report(error, {
          source: 'http',
          silent: true,
          ...options.reportContext,
          userMessage: message,
        });
        return EMPTY;
      }),
      finalize(() => options.loading.set(false))
    );
};

export interface AuthSubmitOptions {
  ignore?: (error: unknown) => boolean;
}

export function handleAuthSubmit<T>(
  destroyRef: DestroyRef,
  loading: WritableSignal<boolean>,
  toast: ToastService,
  options?: AuthSubmitOptions,
): MonoTypeOperatorFunction<T> {
  return (source) => source.pipe(
    catchError(error => {
      if (options?.ignore?.(error)) {
        return EMPTY;
      }
      toast.error(getAuthErrorMessage(error));
      return EMPTY;
    }),
    finalize(() => loading.set(false)),
    takeUntilDestroyed(destroyRef),
  );
}

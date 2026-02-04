import { WritableSignal } from '@angular/core';
import { EMPTY, OperatorFunction, catchError, finalize } from 'rxjs';
import { ErrorContext, ErrorReportingService } from '../services/error-reporting.service';

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

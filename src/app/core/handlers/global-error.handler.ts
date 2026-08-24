import { ErrorHandler, Injectable, Injector, inject, isDevMode } from '@angular/core';
import { ErrorReportingService } from '../services/error-reporting.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  /**
   * We inject the Injector rather than the services directly.
   * This prevents circular dependency errors during the early 
   * bootstrap phase of the application.
   */
  private readonly injector = inject(Injector);
  
  private isReporting = false;

  handleError(error: unknown): void {
    // 1. Always log to console so developers can see it immediately.
    console.error('Global Error Caught:', error);

    // 2. Prevent recursive error loops if the reporting service itself fails.
    if (this.isReporting) {
      return;
    }

    this.isReporting = true;

    try {
      this.reportAndNotify(error);
    } catch (unhandledCriticalError) {
      // Fallback if everything else fails.
      console.error('Critical failure in GlobalErrorHandler:', unhandledCriticalError);
    } finally {
      this.isReporting = false;
    }
  }

  private reportAndNotify(error: unknown): void {
    // Lazily resolve services only when an error actually occurs.
    const reporter = this.injector.get(ErrorReportingService);

    // User notification message
    const message = isDevMode() 
      ? (error as Error)?.message || 'An unknown error occurred'
      : 'Something went wrong. Our team has been notified.';

    // Remote logging and single toast notification
    reporter.report(error, { 
      source: 'runtime',
      url: globalThis.location?.href,
      userMessage: message,
    });
  }
}
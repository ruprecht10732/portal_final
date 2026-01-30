import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorReportingService } from '../services/error-reporting.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly reporter = inject(ErrorReportingService);

  handleError(error: unknown): void {
    this.reporter.report(error, { source: 'runtime' });
  }
}

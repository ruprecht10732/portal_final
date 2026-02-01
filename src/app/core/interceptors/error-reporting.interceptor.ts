import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorReportingService } from '../services/error-reporting.service';

export const errorReportingInterceptor: HttpInterceptorFn = (req, next) => {
  const reporter = inject(ErrorReportingService);
  const apiBaseUrl = environment.apiBaseUrl;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);

  return next(req).pipe(
    catchError(error => {
      if (isApiRequest && error instanceof HttpErrorResponse) {
        // Skip reporting 404s - they're often expected (e.g., checking if a resource exists)
        const is404 = error.status === 404;
        const isSilent = isRefreshRequest && error.status === 401;

        if (!is404) {
          reporter.report(error, {
            source: 'http',
            status: error.status,
            url: req.url,
            silent: isSilent,
          });
        }
      }
      return throwError(() => error);
    })
  );
};

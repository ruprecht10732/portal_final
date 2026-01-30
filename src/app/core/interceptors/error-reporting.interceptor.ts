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
        reporter.report(error, {
          source: 'http',
          status: error.status,
          url: req.url,
          silent: isRefreshRequest && error.status === 401,
        });
      }
      return throwError(() => error);
    })
  );
};

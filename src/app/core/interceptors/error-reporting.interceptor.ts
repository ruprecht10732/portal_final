import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorReportingService } from '../services/error-reporting.service';
import { SKIP_GLOBAL_ERROR_REPORTING } from './error-reporting-context';

export const errorReportingInterceptor: HttpInterceptorFn = (req, next) => {
  const reporter = inject(ErrorReportingService);
  const router = inject(Router);
  const apiBaseUrl = environment.apiBaseUrl;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);
  const skipGlobalReporting = req.context.get(SKIP_GLOBAL_ERROR_REPORTING);

  return next(req).pipe(
    catchError(error => {
      if (isApiRequest && error instanceof HttpErrorResponse) {
        // Skip reporting 404s - they're often expected (e.g., checking if a resource exists)
        const is404 = error.status === 404;
        const isOnboardingRoute = router.url.includes('onboarding');
        const errorPayload = error.error as { error?: string } | string | null;
        const errorMessage = typeof errorPayload === 'string' ? errorPayload : errorPayload?.error;
        const isOrgRequired = error.status === 403 && errorMessage === 'organization required';
        const isSilent =
          isAuthRequest ||
          skipGlobalReporting ||
          (isRefreshRequest && error.status === 401) ||
          (isOnboardingRoute && isOrgRequired);

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

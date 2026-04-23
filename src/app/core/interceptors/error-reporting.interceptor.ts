import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorReportingService } from '../services/error-reporting.service';
import { SKIP_GLOBAL_ERROR_REPORTING } from './error-reporting-context';

export const errorReportingInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Dependency Injections
  const reporter = inject(ErrorReportingService);
  const router = inject(Router);

  // 2. Request Context & URL Analysis
  const { apiBaseUrl } = environment;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);
  const skipGlobalReporting = req.context.get(SKIP_GLOBAL_ERROR_REPORTING);

  return next(req).pipe(
    catchError((error) => {
      // 3. Guard Clauses (Early Exits)
      const isHttpError = error instanceof HttpErrorResponse;
      const is404 = isHttpError && error.status === 404;

      // Skip non-API requests, non-HTTP errors, and expected 404s immediately
      if (!isApiRequest || !isHttpError || is404) {
        return throwError(() => error);
      }

      // 4. Extract Error Details
      const errorPayload = error.error as { error?: string } | string | null;
      const errorMessage = typeof errorPayload === 'string' ? errorPayload : errorPayload?.error;

      // 5. Evaluate Silent Reporting Conditions
      const isOnboardingRoute = router.url.includes('onboarding');
      const isOrgRequired = error.status === 403 && errorMessage === 'organization required';

      const isSilent = Boolean(
        skipGlobalReporting ||
        isAuthRequest ||
        (isRefreshRequest && error.status === 401) ||
        (isOnboardingRoute && isOrgRequired)
      );

      // 6. Report the Error
      reporter.report(error, {
        source: 'http',
        status: error.status,
        url: req.url,
        silent: isSilent,
      });

      return throwError(() => error);
    })
  );
};
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

  const { apiBaseUrl } = environment;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const skipGlobalReporting = req.context.get(SKIP_GLOBAL_ERROR_REPORTING);

  return next(req).pipe(
    catchError((error) => {
      const isHttpError = error instanceof HttpErrorResponse;

      // Skip non-API requests, non-HTTP errors, and expected 404s immediately
      if (!isApiRequest || !isHttpError || error.status === 404) {
        return throwError(() => error);
      }

      const errorPayload = error.error as { error?: string } | string | null;
      const errorMessage = typeof errorPayload === 'string' ? errorPayload : errorPayload?.error;

      const isOnboardingRoute = router.url.includes('onboarding') || router.url.includes('sign-in') || router.url === '/';
      const isOrgRequired = error.status === 403 && (errorMessage === 'organization required' || req.url.endsWith('/organization'));
      const isAuthRefresh = error.status === 401;

      const isSilent = Boolean(
        skipGlobalReporting ||
        isAuthRequest ||
        isAuthRefresh ||
        isOrgRequired ||
        (isOnboardingRoute && isOrgRequired)
      );

      reporter.report(error, {
        source: 'http',
        status: error.status,
        url: req.url,
        silent: isSilent,
      });

      return throwError(() => error);
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, share, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AUTH_ACCOUNT_UID } from './account-request-context';
import { AccountRegistryService } from '../services/account-registry.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { getAuthErrorMessage } from '../utils/auth-error-mapper';
import { isJwtExpired } from '../utils/jwt-token.utils';

// State stored outside the functional interceptor to share across concurrent requests
const inFlightRefreshes = new Map<string, Observable<string>>();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl } = environment;

  // 1. Early Exit: Ignore non-API routes, Auth routes, or requests that already have an Auth header
  if (
    !req.url.startsWith(apiBaseUrl) || 
    req.url.startsWith(`${apiBaseUrl}/auth/`) || 
    req.headers.has('Authorization')
  ) {
    return next(req);
  }

  // 2. Dependency Injections
  const accounts = inject(AccountRegistryService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  // 3. Resolve Target Account (Using updated Signal architecture)
  const requestedUid = req.context.get(AUTH_ACCOUNT_UID);
  const targetAccount = requestedUid
    ? accounts.getUsableAccount(requestedUid)
    : accounts.usableActiveAccount();

  if (!targetAccount) {
    return next(req);
  }

  // 4. Core Utilities
  const attachToken = (request: HttpRequest<unknown>, token: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  const handleFatalAuthError = (error: unknown) => {
    accounts.markExpired(targetAccount.uid);
    toast.error(getAuthErrorMessage(error));

    const fallbackAccount = accounts.findNextAvailableAccount(targetAccount.uid);

    if (!requestedUid && fallbackAccount) {
      accounts.switchAccount(fallbackAccount.uid);
      // Hard reload prevents previous tenant/account data from leaking into the new view
      globalThis.location.assign('/app/dashboard'); 
    } else {
      void router.navigate(['/sign-in']);
    }

    return throwError(() => error);
  };

  /**
   * Safely executes a refresh, ensuring concurrent requests share the same API call.
   */
  const getRefreshedToken = (): Observable<string> => {
    if (!targetAccount.refreshToken) {
      return handleFatalAuthError(new Error('No refresh token available'));
    }

    // If a refresh is already happening for this user, wait for it instead of starting a new one
    if (inFlightRefreshes.has(targetAccount.uid)) {
      return inFlightRefreshes.get(targetAccount.uid)!;
    }

    const refresh$ = authService.refresh(targetAccount.refreshToken, targetAccount.uid).pipe(
      map(res => res.accessToken),
      catchError(err => handleFatalAuthError(err)),
      // Clean up the lock once the request completes or fails
      finalize(() => inFlightRefreshes.delete(targetAccount.uid)),
      // CRITICAL: Multicast this observable to all waiting subscribers
      share() 
    );

    inFlightRefreshes.set(targetAccount.uid, refresh$);
    return refresh$;
  };

  // 5. Execution Flow

  // Strategy A: Proactive Refresh (Token is known to be expired before sending)
  if (isJwtExpired(targetAccount.token)) {
    return getRefreshedToken().pipe(
      // Calling next() directly prevents the retry from looping back through this interceptor
      switchMap(newToken => next(attachToken(req, newToken)))
    );
  }

  // Strategy B: Reactive Refresh (Token seems fine, but backend throws 401)
  return next(attachToken(req, targetAccount.token)).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return getRefreshedToken().pipe(
          switchMap(newToken => next(attachToken(req, newToken)))
        );
      }
      // If it's a 500, 403, 404, etc., just pass the error along
      return throwError(() => error);
    })
  );
};
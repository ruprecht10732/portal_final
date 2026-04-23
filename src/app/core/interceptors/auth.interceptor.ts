import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_ACCOUNT_UID } from './account-request-context';
import { AccountRegistryService } from '../services/account-registry.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { getAuthErrorMessage } from '../utils/auth-error-mapper';
import { isJwtExpired } from '../utils/jwt-token.utils';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Dependency Injections
  const accounts = inject(AccountRegistryService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  // 2. Request Context & URL Analysis
  const requestedAccountUID = req.context.get(AUTH_ACCOUNT_UID);
  const selectedAccount = requestedAccountUID
    ? accounts.getUsableAccount(requestedAccountUID)
    : accounts.usableActiveAccountValue;

  const accessToken = selectedAccount?.token ?? null;
  const { apiBaseUrl } = environment;

  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);

  // 3. Reusable Helpers
  const withToken = (request: HttpRequest<unknown>, token: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  const handleExpiredAccount = (error: unknown) => {
    if (selectedAccount?.uid) {
      accounts.markExpired(selectedAccount.uid);
    }

    const nextAccount = accounts.findNextAvailableAccount(selectedAccount?.uid);
    toast.error(getAuthErrorMessage(error));

    // Consolidated routing logic
    if (!requestedAccountUID && nextAccount) {
      accounts.switchAccount(nextAccount.uid);
      globalThis.location.assign('/app/dashboard');
    } else {
      void router.navigate(['/sign-in']);
    }

    return throwError(() => error);
  };

  const handleRefreshFailure = (error: unknown) => {
    // Inverted logic for clarity
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return handleExpiredAccount(error);
    }
    
    toast.error(getAuthErrorMessage(error));
    return throwError(() => error);
  };

  // 4. Initial Request Setup
  const authReq = (accessToken && isApiRequest && !req.headers.has('Authorization'))
    ? withToken(req, accessToken)
    : req;

  // 5. Core Execution & Reactive Refresh (Catches 401s)
  const executeRequest = (request = authReq) => next(request).pipe(
    catchError(error => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isEligibleForRefresh = isApiRequest && !isAuthRequest && !isRefreshRequest && isUnauthorized;

      if (!isEligibleForRefresh) {
        return throwError(() => error);
      }

      if (!selectedAccount?.refreshToken) {
        return handleExpiredAccount(error);
      }

      return authService.refresh(selectedAccount.refreshToken, selectedAccount.uid).pipe(
        // Passes to `next` directly to prevent infinite loops if the refreshed request also 401s
        switchMap(response => next(withToken(request, response.accessToken))),
        catchError(handleRefreshFailure)
      );
    })
  );

  // 6. Proactive Refresh (Checks expiration before sending)
  const shouldProactivelyRefresh = Boolean(
    selectedAccount?.refreshToken &&
    accessToken &&
    isApiRequest &&
    !isAuthRequest &&
    !isRefreshRequest &&
    isJwtExpired(accessToken)
  );

  if (shouldProactivelyRefresh && selectedAccount?.refreshToken) {
    return authService.refresh(selectedAccount.refreshToken, selectedAccount.uid).pipe(
      // Passes back to `executeRequest` so we still catch 401s just in case
      switchMap(response => executeRequest(withToken(req, response.accessToken))),
      catchError(handleRefreshFailure)
    );
  }

  // 7. Default Fallthrough
  return executeRequest();
};
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AUTH_ACCOUNT_UID } from './account-request-context';
import { AccountRegistryService } from '../services/account-registry.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { getAuthErrorMessage } from '../utils/auth-error-mapper';
import { isJwtExpired } from '../utils/jwt-token.utils';

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

  // 3. Resolve Target Account
  const requestedUid = req.context.get(AUTH_ACCOUNT_UID);
  const targetAccount = requestedUid
    ? accounts.getUsableAccount(requestedUid)
    : accounts.usableActiveAccount();

  if (!targetAccount) {
    return next(req);
  }

  const attachToken = (token: string) =>
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  const handleFatalAuthError = (error: unknown) => {
    accounts.markExpired(targetAccount.uid);
    toast.error(getAuthErrorMessage(error));

    const fallbackAccount = accounts.findNextAvailableAccount(targetAccount.uid);

    if (!requestedUid && fallbackAccount) {
      accounts.switchAccount(fallbackAccount.uid);
      globalThis.location.assign('/app/dashboard');
    } else {
      void router.navigate(['/sign-in']);
    }

    return throwError(() => error);
  };

  const refreshAndRetry = () => {
    if (!targetAccount.refreshToken) {
      return handleFatalAuthError(new Error('No refresh token available'));
    }

    return authService.refresh(targetAccount.refreshToken, targetAccount.uid).pipe(
      map(res => res.accessToken),
      catchError(err => handleFatalAuthError(err)),
      switchMap(newToken => next(attachToken(newToken))),
    );
  };

  // Strategy A: Proactive Refresh (Token is known to be expired before sending)
  if (isJwtExpired(targetAccount.token)) {
    return refreshAndRetry();
  }

  // Strategy B: Reactive Refresh (Token seems fine, but backend throws 401)
  return next(attachToken(targetAccount.token)).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return refreshAndRetry();
      }
      return throwError(() => error);
    }),
  );
};

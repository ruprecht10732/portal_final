import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
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
  const accounts = inject(AccountRegistryService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const requestedAccountUID = req.context.get(AUTH_ACCOUNT_UID);
  const selectedAccount = requestedAccountUID
    ? accounts.getUsableAccount(requestedAccountUID)
    : accounts.usableActiveAccountValue;
  const accessToken = selectedAccount?.token ?? null;
  const apiBaseUrl = environment.apiBaseUrl;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);

  const authReq = accessToken && isApiRequest && !req.headers.has('Authorization')
    ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    : req;

  const handleExpiredAccount = (error: unknown) => {
    if (selectedAccount?.uid) {
      accounts.markExpired(selectedAccount.uid);
    }

    const nextAccount = accounts.findNextAvailableAccount(selectedAccount?.uid);
    toast.error(getAuthErrorMessage(error));

    if (!requestedAccountUID && nextAccount) {
      accounts.switchAccount(nextAccount.uid);
      globalThis.location.assign('/app/dashboard');
      return throwError(() => error);
    }

    void router.navigate(['/sign-in']);
    return throwError(() => error);
  };

  const handleRefreshFailure = (error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
      toast.error(getAuthErrorMessage(error));
      return throwError(() => error);
    }

    return handleExpiredAccount(error);
  };

  const shouldProactivelyRefresh = !!(
    selectedAccount?.refreshToken
    && accessToken
    && isApiRequest
    && !isAuthRequest
    && !isRefreshRequest
    && isJwtExpired(accessToken)
  );

  const executeRequest = (request = authReq) => next(request).pipe(
    catchError(error => {
      if (!isApiRequest || isRefreshRequest || isAuthRequest || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!selectedAccount?.refreshToken) {
        return handleExpiredAccount(error);
      }

      return authService.refresh(selectedAccount.refreshToken, selectedAccount.uid).pipe(
        switchMap(response =>
          next(
            request.clone({
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            })
          )
        ),
        catchError(refreshError => handleRefreshFailure(refreshError))
      );
    })
  );

  if (shouldProactivelyRefresh) {
    return authService.refresh(selectedAccount.refreshToken, selectedAccount.uid).pipe(
      switchMap(response =>
        executeRequest(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          })
        )
      ),
      catchError(refreshError => handleRefreshFailure(refreshError))
    );
  }

  return executeRequest();
};

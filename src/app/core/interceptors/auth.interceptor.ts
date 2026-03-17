import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountRegistryService } from '../services/account-registry.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { getAuthErrorMessage } from '../utils/auth-error-mapper';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const accounts = inject(AccountRegistryService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const activeAccount = accounts.usableActiveAccountValue;
  const accessToken = activeAccount?.token ?? null;
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
    if (activeAccount?.uid) {
      accounts.markExpired(activeAccount.uid);
    }

    const nextAccount = accounts.findNextAvailableAccount(activeAccount?.uid);
    toast.error(getAuthErrorMessage(error));

    if (nextAccount) {
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

  return next(authReq).pipe(
    catchError(error => {
      if (!isApiRequest || isRefreshRequest || isAuthRequest || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!activeAccount?.refreshToken) {
        return handleExpiredAccount(error);
      }

      return authService.refresh(activeAccount.refreshToken).pipe(
        switchMap(response =>
          next(
            authReq.clone({
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
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorageService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const accessToken = tokens.accessTokenValue;
  const apiBaseUrl = environment.apiBaseUrl;
  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const isAuthRequest = req.url.startsWith(`${apiBaseUrl}/auth/`);
  const isRefreshRequest = req.url.startsWith(`${apiBaseUrl}/auth/refresh`);

  const authReq = accessToken && isApiRequest && !isAuthRequest
    ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    : req;

  return next(authReq).pipe(
    catchError(error => {
      if (!isApiRequest || isRefreshRequest || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authService.refresh().pipe(
        switchMap(response =>
          next(
            authReq.clone({
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`,
              },
            })
          )
        ),
        catchError(refreshError => {
          tokens.clear();
          void router.navigate(['/sign-in']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};

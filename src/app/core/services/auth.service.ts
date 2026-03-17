import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountRegistryService } from './account-registry.service';
import { decodeJwtClaims } from '../utils/jwt-token.utils';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  inviteToken?: string;
}

export interface ResolveInviteResponse {
  email: string;
  organizationName: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  userId: string;
  email: string;
}

type PostBodyOptions = {
  withCredentials: boolean;
  headers?: HttpHeaders;
};

interface MessageResponse {
  message: string;
}


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accounts = inject(AccountRegistryService);
  private readonly baseUrl = environment.apiBaseUrl;
  private refreshInFlight: Observable<AuthResponse> | null = null;
  private refreshInFlightKey: string | null = null;

  signIn(payload: SignInRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/sign-in`, payload, { withCredentials: true }).pipe(
      tap(response => {
        const claims = decodeJwtClaims(response.accessToken);
        const uid = claims?.sub?.trim();
        if (!uid) {
          throw new Error('token invalid');
        }

        this.accounts.addAccount(uid, claims?.email?.trim() || payload.email.trim(), response.accessToken, response.refreshToken);
      })
    );
  }

  signUp(payload: SignUpRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/sign-up`, payload);
  }

  refresh(refreshToken?: string, accountUID?: string): Observable<AuthResponse> {
    const targetAccount = accountUID ? this.accounts.getAccount(accountUID) : this.accounts.activeAccountValue;
    const resolvedRefreshToken = refreshToken ?? targetAccount?.refreshToken ?? '';
    const refreshKey = `${targetAccount?.uid ?? 'anonymous'}:${resolvedRefreshToken}`;

    if (!resolvedRefreshToken) {
      return throwError(() => new Error('token invalid'));
    }

    if (this.refreshInFlight && this.refreshInFlightKey === refreshKey) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.http
      .post<AuthResponse>(
        `${this.baseUrl}/auth/refresh`,
        refreshToken ? { refreshToken: resolvedRefreshToken } : null,
        { withCredentials: !refreshToken }
      )
      .pipe(
        tap(response => {
          const claims = decodeJwtClaims(response.accessToken);
          const uid = claims?.sub?.trim() || targetAccount?.uid;
          if (!uid) {
            throw new Error('token invalid');
          }

          this.accounts.updateTokens(uid, response.accessToken, response.refreshToken, claims?.email?.trim() || targetAccount?.email);
        }),
        finalize(() => {
          this.refreshInFlight = null;
          this.refreshInFlightKey = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    this.refreshInFlightKey = refreshKey;

    return this.refreshInFlight;
  }

  signOut(refreshToken?: string): Observable<MessageResponse> {
    const activeAccount = this.accounts.activeAccountValue;
    const resolvedRefreshToken = refreshToken ?? this.accounts.activeAccountValue?.refreshToken;
    const authorizationToken = activeAccount?.token;
    const options: PostBodyOptions = {
      withCredentials: !resolvedRefreshToken,
    };

    if (authorizationToken) {
      options.headers = new HttpHeaders({ Authorization: `Bearer ${authorizationToken}` });
    }

    return this.http.post<MessageResponse>(
      `${this.baseUrl}/auth/sign-out`,
      resolvedRefreshToken ? { refreshToken: resolvedRefreshToken } : null,
      options
    ).pipe(
      tap(() => {
        this.refreshInFlight = null;
        this.refreshInFlightKey = null;
      })
    );
  }

  signOutAllAccounts(): Observable<MessageResponse[]> {
    const accounts = this.accounts.accounts();
    if (accounts.length === 0) {
      return throwError(() => new Error('no accounts available'));
    }

    return forkJoin(
      accounts.map(account => {
        const options: PostBodyOptions = {
          withCredentials: !account.refreshToken,
        };

        if (account.token) {
          options.headers = new HttpHeaders({ Authorization: `Bearer ${account.token}` });
        }

        return this.http.post<MessageResponse>(
          `${this.baseUrl}/auth/sign-out`,
          account.refreshToken ? { refreshToken: account.refreshToken } : null,
          options
        );
      })
    ).pipe(
      map(responses => responses.filter(Boolean))
    );
  }

  verifyToken(token: string): Observable<VerifyTokenResponse> {
    return this.http.get<VerifyTokenResponse>(`${this.baseUrl}/auth/verify`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
      }),
    });
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/forgot-password`, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/reset-password`, payload);
  }

  verifyEmail(payload: VerifyEmailRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/verify-email`, payload);
  }

  resolveInvite(token: string): Observable<ResolveInviteResponse> {
    return this.http.get<ResolveInviteResponse>(`${this.baseUrl}/auth/invites/resolve`, {
      params: { token }
    });
  }

}

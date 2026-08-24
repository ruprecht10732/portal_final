import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
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

interface MessageResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accounts = inject(AccountRegistryService);
  private readonly baseUrl = environment.apiBaseUrl;
  
  // CRITICAL: Multi-tenant concurrency lock. 
  // Prevents Account B from hijacking Account A's in-flight refresh.
  private readonly inFlightRefreshes = new Map<string, Observable<AuthResponse>>();

  signIn(payload: SignInRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/sign-in`, payload, { withCredentials: true }).pipe(
      tap(({ accessToken, refreshToken }) => {
        const claims = decodeJwtClaims(accessToken);
        const uid = claims?.sub?.trim();
        
        if (!uid) {
          throw new Error('Invalid token payload received during sign-in.');
        }

        this.accounts.addAccount(
          uid, 
          claims?.email?.trim() || payload.email.trim(), 
          accessToken, 
          refreshToken
        );
      })
    );
  }

  signUp(payload: SignUpRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/sign-up`, payload);
  }

  refresh(refreshToken?: string, accountUID?: string): Observable<AuthResponse> {
    const targetAccount = accountUID ? this.accounts.getAccount(accountUID) : this.accounts.activeAccount();
    const resolvedToken = refreshToken ?? targetAccount?.refreshToken;
    
    if (!resolvedToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    // Use UID as the lock key, fallback to the token string if totally anonymous
    const lockKey = targetAccount?.uid ?? resolvedToken;

    if (this.inFlightRefreshes.has(lockKey)) {
      return this.inFlightRefreshes.get(lockKey)!;
    }

    const request$ = this.http.post<AuthResponse>(
      `${this.baseUrl}/auth/refresh`,
      refreshToken ? { refreshToken: resolvedToken } : null,
      { withCredentials: !refreshToken }
    ).pipe(
      tap(({ accessToken, refreshToken: newRefreshToken }) => {
        const claims = decodeJwtClaims(accessToken);
        const uid = claims?.sub?.trim() || targetAccount?.uid;
        
        if (uid) {
          this.accounts.updateTokens(
            uid, 
            accessToken, 
            newRefreshToken, 
            claims?.email?.trim() || targetAccount?.email
          );
        }
      }),
      finalize(() => this.inFlightRefreshes.delete(lockKey)),
      // shareReplay caches the latest emission for late subscribers within the flight window
      shareReplay({ bufferSize: 1, refCount: false }) 
    );

    this.inFlightRefreshes.set(lockKey, request$);
    return request$;
  }

  signOut(refreshToken?: string): Observable<MessageResponse> {
    const targetAccount = this.accounts.activeAccount();
    const resolvedToken = refreshToken ?? targetAccount?.refreshToken;
    
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/auth/sign-out`,
      resolvedToken ? { refreshToken: resolvedToken } : null,
      { 
        withCredentials: !resolvedToken,
        headers: this.buildAuthHeaders(targetAccount?.token)
      }
    );
  }

  signOutAllAccounts(): Observable<MessageResponse[]> {
    const currentAccounts = this.accounts.accounts();
    if (currentAccounts.length === 0) {
      return throwError(() => new Error('No accounts available to sign out.'));
    }

    const requests = currentAccounts.map(account =>
      this.http.post<MessageResponse>(
        `${this.baseUrl}/auth/sign-out`,
        account.refreshToken ? { refreshToken: account.refreshToken } : null,
        { 
          withCredentials: !account.refreshToken,
          headers: this.buildAuthHeaders(account.token)
        }
      )
    );

    return forkJoin(requests);
  }

  verifyToken(token: string): Observable<VerifyTokenResponse> {
    return this.http.get<VerifyTokenResponse>(`${this.baseUrl}/auth/verify`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
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

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/resend-verification`, { email });
  }

  resolveInvite(token: string): Observable<ResolveInviteResponse> {
    return this.http.get<ResolveInviteResponse>(`${this.baseUrl}/auth/invites/resolve`, {
      params: { token }
    });
  }

  private buildAuthHeaders(token?: string): HttpHeaders {
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }
}

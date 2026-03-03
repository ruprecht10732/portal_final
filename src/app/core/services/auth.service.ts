import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';

export interface AuthResponse {
  accessToken: string;
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

interface MessageResponse {
  message: string;
}


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);
  private readonly baseUrl = environment.apiBaseUrl;
  private refreshInFlight: Observable<AuthResponse> | null = null;

  signIn(payload: SignInRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/sign-in`, payload, { withCredentials: true }).pipe(
      tap(response => this.tokens.setAccessToken(response.accessToken))
    );
  }

  signUp(payload: SignUpRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/sign-up`, payload);
  }

  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/refresh`, null, { withCredentials: true })
      .pipe(
        tap(response => this.tokens.setAccessToken(response.accessToken)),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.refreshInFlight;
  }

  signOut(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/sign-out`, null, { withCredentials: true }).pipe(
      tap(() => {
        this.tokens.clear();
        this.refreshInFlight = null;
      })
    );
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

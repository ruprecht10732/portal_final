import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ChangePasswordRequest, CompleteOnboardingRequest, UpdateProfileRequest, UserProfile, UserSummary } from './user.types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/me`);
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.baseUrl}/me`, data);
  }

  completeOnboarding(data: CompleteOnboardingRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/me/onboarding`, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/me/password`, data);
  }

  listUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.baseUrl);
  }
}

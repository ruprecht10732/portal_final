import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ChangePasswordRequest,
  CompleteOnboardingRequest,
  CreateIMAPAccountRequest,
  DetectIMAPAccountResponse,
  IMAPAccount,
  IMAPMessageContent,
  IMAPMessageListResponse,
  ReplyIMAPMessageRequest,
  SendIMAPMessageRequest,
  UpdateIMAPAccountRequest,
  UpdateProfileRequest,
  UserProfile,
  UserSummary,
} from './user.types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;
  private readonly imapBaseUrl = `${this.baseUrl}/me/imap-accounts`;

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/me`);
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.baseUrl}/me`, data);
  }

  completeOnboarding(data: CompleteOnboardingRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/me/onboarding`, data);
  }

  markOnboardingComplete(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/me/onboarding/complete`, {});
  }

  changePassword(data: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/me/password`, data);
  }

  listUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.baseUrl);
  }

  listIMAPAccounts(): Observable<IMAPAccount[]> {
    return this.http.get<IMAPAccount[]>(this.imapBaseUrl);
  }

  createIMAPAccount(data: CreateIMAPAccountRequest): Observable<IMAPAccount> {
    return this.http.post<IMAPAccount>(this.imapBaseUrl, data);
  }

  updateIMAPAccount(accountId: string, data: UpdateIMAPAccountRequest): Observable<IMAPAccount> {
    return this.http.patch<IMAPAccount>(`${this.imapBaseUrl}/${accountId}`, data);
  }

  deleteIMAPAccount(accountId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.imapBaseUrl}/${accountId}`);
  }

  testIMAPAccount(accountId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/test`, {});
  }

  syncIMAPAccount(accountId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/sync`, {});
  }

  listIMAPMessages(accountId: string, page = 1, pageSize = 25): Observable<IMAPMessageListResponse> {
    return this.http.get<IMAPMessageListResponse>(`${this.imapBaseUrl}/${accountId}/messages`, {
      params: {
        page: String(page),
        pageSize: String(pageSize),
      },
    });
  }

  deleteIMAPMessage(accountId: string, uid: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/delete`, {});
  }

  markIMAPMessageSeen(accountId: string, uid: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/seen`, {});
  }

  markIMAPMessageUnseen(accountId: string, uid: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/unseen`, {});
  }

  detectIMAPAccount(email: string): Observable<DetectIMAPAccountResponse> {
    return this.http.post<DetectIMAPAccountResponse>(`${this.imapBaseUrl}/detect`, { email });
  }

  getIMAPMessageContent(accountId: string, uid: number): Observable<IMAPMessageContent> {
    return this.http.get<IMAPMessageContent>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/content`);
  }

  sendIMAPMessage(accountId: string, payload: SendIMAPMessageRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/send`, payload);
  }

  replyIMAPMessage(accountId: string, uid: number, payload: ReplyIMAPMessageRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/reply`, payload);
  }

  replyAllIMAPMessage(accountId: string, uid: number, payload: ReplyIMAPMessageRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/reply-all`, payload);
  }
}

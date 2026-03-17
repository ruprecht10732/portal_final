import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateLeadRequest } from './leads.types';
import type {
  ChangePasswordRequest,
  CompleteOnboardingRequest,
  CreateIMAPAccountRequest,
  DetectIMAPAccountResponse,
  IMAPAccount,
  IMAPOutboundMessageListResponse,
  IMAPUnreadCountResponse,
  IMAPMessageContent,
  IMAPMessageLeadLinkResponse,
  IMAPMessageListResponse,
  LinkIMAPMessageLeadRequest,
  ReplyIMAPMessageRequest,
  ReplyScenarioAnalyticsItem,
  SuggestIMAPReplyRequest,
  SendIMAPMessageRequest,
  SuggestIMAPReplyResponse,
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
  private usersCache: UserSummary[] | null = null;
  private usersRequest: Observable<UserSummary[]> | null = null;

  getProfile(options?: { context?: HttpContext }): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${this.baseUrl}/me`,
      options?.context ? { context: options.context } : undefined,
    );
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.baseUrl}/me`, data).pipe(
      tap(() => this.clearUsersCache())
    );
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
    if (this.usersCache) {
      return of(this.usersCache);
    }
    if (this.usersRequest) {
      return this.usersRequest;
    }

    this.usersRequest = this.http.get<UserSummary[]>(this.baseUrl).pipe(
      tap(users => {
        this.usersCache = users;
      }),
      finalize(() => {
        this.usersRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.usersRequest;
  }

  private clearUsersCache(): void {
    this.usersCache = null;
    this.usersRequest = null;
  }

  listIMAPAccounts(): Observable<IMAPAccount[]> {
    return this.http.get<IMAPAccount[]>(this.imapBaseUrl);
  }

  getIMAPUnreadCount(): Observable<IMAPUnreadCountResponse> {
    return this.http.get<IMAPUnreadCountResponse>(`${this.imapBaseUrl}/unread-count`);
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

  listIMAPOutboundMessages(accountId: string): Observable<IMAPOutboundMessageListResponse> {
    return this.http.get<IMAPOutboundMessageListResponse>(`${this.imapBaseUrl}/${accountId}/outbox`);
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

  linkIMAPMessageLead(accountId: string, uid: number, payload: LinkIMAPMessageLeadRequest): Observable<IMAPMessageLeadLinkResponse> {
    return this.http.post<IMAPMessageLeadLinkResponse>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/lead`, payload);
  }

  unlinkIMAPMessageLead(accountId: string, uid: number): Observable<IMAPMessageLeadLinkResponse> {
    return this.http.delete<IMAPMessageLeadLinkResponse>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/lead`);
  }

  createLeadFromIMAPMessage(accountId: string, uid: number, payload: CreateLeadRequest): Observable<IMAPMessageLeadLinkResponse> {
    return this.http.post<IMAPMessageLeadLinkResponse>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/create-lead`, payload);
  }

  suggestIMAPReply(accountId: string, uid: number, payload: SuggestIMAPReplyRequest = {}): Observable<SuggestIMAPReplyResponse> {
    return this.http.post<SuggestIMAPReplyResponse>(`${this.imapBaseUrl}/${accountId}/messages/${uid}/suggest-reply`, payload);
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

  getIMAPReplyScenarioAnalytics(): Observable<ReplyScenarioAnalyticsItem[]> {
    return this.http.get<{ items: ReplyScenarioAnalyticsItem[] }>(`${this.imapBaseUrl}/reply-scenario-analytics`).pipe(
      map(response => response.items)
    );
  }
}

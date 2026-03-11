import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateLeadRequest } from './leads.types';
import type {
  AttachWhatsAppMessageToLeadRequest,
  AttachWhatsAppMessageToLeadResponse,
  EditWhatsAppMessageRequest,
  LinkWhatsAppConversationLeadRequest,
  MarkWhatsAppConversationReadResponse,
  ReactWhatsAppMessageRequest,
  SaveWhatsAppMessagesToLeadRequest,
  SaveWhatsAppMessagesToLeadResponse,
  SetWhatsAppDisappearingTimerRequest,
  SendWhatsAppChatPresenceRequest,
  SendWhatsAppChatPresenceResponse,
  SendWhatsAppConversationMessageRequest,
  SendWhatsAppConversationMessageResponse,
  SendWhatsAppPresenceRequest,
  SendWhatsAppPresenceResponse,
  SuggestWhatsAppReplyResponse,
  ToggleWhatsAppConversationStateRequest,
  ToggleWhatsAppMessageStateRequest,
  WhatsAppConversationActionResponse,
  WhatsAppConversationLeadResponse,
  WhatsAppConversationListResponse,
  WhatsAppConversationMessagesResponse,
  WhatsAppMediaDownloadResponse,
  WhatsAppUnreadConversationCountResponse,
} from './whatsapp-inbox.types';

@Injectable({ providedIn: 'root' })
export class WhatsAppInboxService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/whatsapp/conversations`;

  listConversations(limit = 50): Observable<WhatsAppConversationListResponse> {
    return this.http.get<WhatsAppConversationListResponse>(this.baseUrl, {
      params: { limit: String(limit) },
    });
  }

  getUnreadConversationCount(): Observable<WhatsAppUnreadConversationCountResponse> {
    return this.http.get<WhatsAppUnreadConversationCountResponse>(`${this.baseUrl}/unread-count`);
  }

  getConversationMessages(conversationId: string, limit = 200): Observable<WhatsAppConversationMessagesResponse> {
    return this.http.get<WhatsAppConversationMessagesResponse>(`${this.baseUrl}/${conversationId}/messages`, {
      params: { limit: String(limit) },
    });
  }

  linkConversationLead(conversationId: string, payload: LinkWhatsAppConversationLeadRequest): Observable<WhatsAppConversationLeadResponse> {
    return this.http.post<WhatsAppConversationLeadResponse>(`${this.baseUrl}/${conversationId}/lead`, payload);
  }

  unlinkConversationLead(conversationId: string): Observable<WhatsAppConversationLeadResponse> {
    return this.http.delete<WhatsAppConversationLeadResponse>(`${this.baseUrl}/${conversationId}/lead`);
  }

  createLeadFromConversation(conversationId: string, payload: CreateLeadRequest): Observable<WhatsAppConversationLeadResponse> {
    return this.http.post<WhatsAppConversationLeadResponse>(`${this.baseUrl}/${conversationId}/create-lead`, payload);
  }

  sendConversationMessage(
    conversationId: string,
    payload: SendWhatsAppConversationMessageRequest,
  ): Observable<SendWhatsAppConversationMessageResponse> {
    return this.http.post<SendWhatsAppConversationMessageResponse>(`${this.baseUrl}/${conversationId}/messages`, payload);
  }

  suggestReply(conversationId: string): Observable<SuggestWhatsAppReplyResponse> {
    return this.http.post<SuggestWhatsAppReplyResponse>(`${this.baseUrl}/${conversationId}/suggest-reply`, {});
  }

  markConversationRead(conversationId: string): Observable<MarkWhatsAppConversationReadResponse> {
    return this.http.post<MarkWhatsAppConversationReadResponse>(`${this.baseUrl}/${conversationId}/read`, {});
  }

  deleteMessage(conversationId: string, messageId: string): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(
      `${this.baseUrl}/${conversationId}/messages/${messageId}/delete`,
      {},
    );
  }

  revokeMessage(conversationId: string, messageId: string): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(
      `${this.baseUrl}/${conversationId}/messages/${messageId}/revoke`,
      {},
    );
  }

  editMessage(
    conversationId: string,
    messageId: string,
    payload: EditWhatsAppMessageRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(
      `${this.baseUrl}/${conversationId}/messages/${messageId}/edit`,
      payload,
    );
  }

  reactToMessage(
    conversationId: string,
    messageId: string,
    payload: ReactWhatsAppMessageRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(
      `${this.baseUrl}/${conversationId}/messages/${messageId}/reaction`,
      payload,
    );
  }

  setConversationArchived(
    conversationId: string,
    payload: ToggleWhatsAppConversationStateRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(`${this.baseUrl}/${conversationId}/archive`, payload);
  }

  setConversationPinned(
    conversationId: string,
    payload: ToggleWhatsAppConversationStateRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(`${this.baseUrl}/${conversationId}/pin`, payload);
  }

  setConversationDisappearingTimer(
    conversationId: string,
    payload: SetWhatsAppDisappearingTimerRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(`${this.baseUrl}/${conversationId}/disappearing-timer`, payload);
  }

  setMessageStarred(
    conversationId: string,
    messageId: string,
    payload: ToggleWhatsAppMessageStateRequest,
  ): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(`${this.baseUrl}/${conversationId}/messages/${messageId}/star`, payload);
  }

  downloadMessageMedia(conversationId: string, messageId: string): Observable<WhatsAppMediaDownloadResponse> {
    return this.http.get<WhatsAppMediaDownloadResponse>(`${this.baseUrl}/${conversationId}/messages/${messageId}/download`);
  }

  deleteConversation(conversationId: string): Observable<WhatsAppConversationActionResponse> {
    return this.http.post<WhatsAppConversationActionResponse>(`${this.baseUrl}/${conversationId}/delete`, {});
  }

  attachMessageToLead(
    conversationId: string,
    messageId: string,
    payload: AttachWhatsAppMessageToLeadRequest = {},
  ): Observable<AttachWhatsAppMessageToLeadResponse> {
    return this.http.post<AttachWhatsAppMessageToLeadResponse>(
      `${this.baseUrl}/${conversationId}/messages/${messageId}/attach-to-lead`,
      payload,
    );
  }

  saveMessagesToLead(
    conversationId: string,
    payload: SaveWhatsAppMessagesToLeadRequest,
  ): Observable<SaveWhatsAppMessagesToLeadResponse> {
    return this.http.post<SaveWhatsAppMessagesToLeadResponse>(`${this.baseUrl}/${conversationId}/messages/save-to-lead`, payload);
  }

  sendPresence(payload: SendWhatsAppPresenceRequest): Observable<SendWhatsAppPresenceResponse> {
    return this.http.post<SendWhatsAppPresenceResponse>(`${environment.apiBaseUrl}/whatsapp/presence`, payload);
  }

  sendChatPresence(
    conversationId: string,
    payload: SendWhatsAppChatPresenceRequest,
  ): Observable<SendWhatsAppChatPresenceResponse> {
    return this.http.post<SendWhatsAppChatPresenceResponse>(`${this.baseUrl}/${conversationId}/chat-presence`, payload);
  }
}
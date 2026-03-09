import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  MarkWhatsAppConversationReadResponse,
  SendWhatsAppChatPresenceRequest,
  SendWhatsAppChatPresenceResponse,
  SendWhatsAppConversationMessageRequest,
  SendWhatsAppConversationMessageResponse,
  SendWhatsAppPresenceRequest,
  SendWhatsAppPresenceResponse,
  SuggestWhatsAppReplyResponse,
  WhatsAppConversationListResponse,
  WhatsAppConversationMessagesResponse,
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
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  SendWhatsAppConversationMessageRequest,
  SendWhatsAppConversationMessageResponse,
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

  markConversationRead(conversationId: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/${conversationId}/read`, {});
  }
}
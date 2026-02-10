import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WebhookAPIKey {
  id: string;
  name: string;
  keyPrefix: string;
  allowedDomains: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookAPIKeyRequest {
  name: string;
  allowedDomains: string[];
}

export interface CreateWebhookAPIKeyResponse extends WebhookAPIKey {
  key: string; // plaintext, shown only once
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/webhook/keys`;

  list(): Observable<WebhookAPIKey[]> {
    return this.http.get<WebhookAPIKey[]>(this.baseUrl);
  }

  create(payload: CreateWebhookAPIKeyRequest): Observable<CreateWebhookAPIKeyResponse> {
    return this.http.post<CreateWebhookAPIKeyResponse>(this.baseUrl, payload);
  }

  revoke(keyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${keyId}`);
  }
}

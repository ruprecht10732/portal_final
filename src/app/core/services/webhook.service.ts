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

export interface GoogleWebhookConfig {
  id: string;
  name: string;
  googleKeyPrefix: string;
  campaignMappings: Record<string, string>;
  isActive: boolean;
  createdAt: string;
}

export interface CreateGoogleWebhookConfigRequest {
  name: string;
}

export interface CreateGoogleWebhookConfigResponse extends GoogleWebhookConfig {
  googleKey: string; // plaintext, shown only once
  webhookUrl: string;
}

export interface UpdateGoogleCampaignMappingRequest {
  campaignId: string;
  serviceType: string;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/webhook/keys`;
  private readonly googleBaseUrl = `${environment.apiBaseUrl}/admin/webhook/google-lead-config`;

  list(): Observable<WebhookAPIKey[]> {
    return this.http.get<WebhookAPIKey[]>(this.baseUrl);
  }

  create(payload: CreateWebhookAPIKeyRequest): Observable<CreateWebhookAPIKeyResponse> {
    return this.http.post<CreateWebhookAPIKeyResponse>(this.baseUrl, payload);
  }

  revoke(keyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${keyId}`);
  }

  listGoogleConfigs(): Observable<GoogleWebhookConfig[]> {
    return this.http.get<GoogleWebhookConfig[]>(this.googleBaseUrl);
  }

  createGoogleConfig(payload: CreateGoogleWebhookConfigRequest): Observable<CreateGoogleWebhookConfigResponse> {
    return this.http.post<CreateGoogleWebhookConfigResponse>(this.googleBaseUrl, payload);
  }

  updateGoogleCampaignMapping(configId: string, payload: UpdateGoogleCampaignMappingRequest): Observable<void> {
    return this.http.put<void>(`${this.googleBaseUrl}/${configId}/campaigns`, payload);
  }

  deleteGoogleCampaignMapping(configId: string, campaignId: string): Observable<void> {
    return this.http.delete<void>(`${this.googleBaseUrl}/${configId}/campaigns/${campaignId}`);
  }

  deleteGoogleConfig(configId: string): Observable<void> {
    return this.http.delete<void>(`${this.googleBaseUrl}/${configId}`);
  }
}

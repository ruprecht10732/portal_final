import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_GLOBAL_ERROR_REPORTING } from '../interceptors/error-reporting-context';

export interface WhatsAppAgentDeviceStatus {
  state: string;
  deviceId?: string;
  accountJid?: string;
  error?: string;
}

export interface RegisterWhatsAppAgentDeviceResponse {
  deviceId: string;
  createdAt: string;
}

export interface WhatsAppAgentWebhookConfig {
  secretHeaderName: string;
  queryParamName: string;
  sharedSecret: string;
}

@Injectable({ providedIn: 'root' })
export class WhatsAppAgentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/superadmin/whatsapp-agent`;

  registerDevice(): Observable<RegisterWhatsAppAgentDeviceResponse> {
    return this.http.post<RegisterWhatsAppAgentDeviceResponse>(`${this.baseUrl}/register`, {});
  }

  getStatus(): Observable<WhatsAppAgentDeviceStatus> {
    return this.http.get<WhatsAppAgentDeviceStatus>(`${this.baseUrl}/status`);
  }

  reconnectDevice(): Observable<{ status: string; deviceId: string }> {
    return this.http.post<{ status: string; deviceId: string }>(`${this.baseUrl}/reconnect`, {});
  }

  disconnectDevice(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }

  getQr(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/qr`, {
      context: new HttpContext().set(SKIP_GLOBAL_ERROR_REPORTING, true),
      responseType: 'blob',
    });
  }

  getWebhookConfig(): Observable<WhatsAppAgentWebhookConfig> {
    return this.http.get<WhatsAppAgentWebhookConfig>(`${this.baseUrl}/webhook-config`);
  }
}
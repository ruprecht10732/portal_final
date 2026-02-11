import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GoogleAdsExportKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface CreateGoogleAdsExportKeyRequest {
  name: string;
}

export interface CreateGoogleAdsExportKeyResponse extends GoogleAdsExportKey {
  key: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleAdsExportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/exports/keys`;

  listKeys(): Observable<GoogleAdsExportKey[]> {
    return this.http.get<GoogleAdsExportKey[]>(this.baseUrl);
  }

  createKey(payload: CreateGoogleAdsExportKeyRequest): Observable<CreateGoogleAdsExportKeyResponse> {
    return this.http.post<CreateGoogleAdsExportKeyResponse>(this.baseUrl, payload);
  }

  revokeKey(keyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${keyId}`);
  }
}

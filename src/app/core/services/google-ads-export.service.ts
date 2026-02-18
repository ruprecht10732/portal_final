import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GoogleAdsExportCredential {
	username: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface UpsertGoogleAdsExportCredentialResponse extends GoogleAdsExportCredential {
	password: string;
}

export interface RevealGoogleAdsExportPasswordResponse {
  password: string;
}

export interface BackfillExportsResponse {
  backfilledRows: number;
}

@Injectable({ providedIn: 'root' })
export class GoogleAdsExportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/exports/credentials`;

  getCredential(): Observable<GoogleAdsExportCredential> {
    return this.http.get<GoogleAdsExportCredential>(this.baseUrl);
  }

  upsertCredential(): Observable<UpsertGoogleAdsExportCredentialResponse> {
    return this.http.post<UpsertGoogleAdsExportCredentialResponse>(this.baseUrl, {});
  }

  deleteCredential(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }

  revealPassword(): Observable<RevealGoogleAdsExportPasswordResponse> {
    return this.http.get<RevealGoogleAdsExportPasswordResponse>(`${this.baseUrl}/password`);
  }

  backfillExports(): Observable<BackfillExportsResponse> {
    return this.http.post<BackfillExportsResponse>(`${environment.apiBaseUrl}/admin/exports/backfill`, {});
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';

export interface StaleLeadItem {
  leadId: string;
  serviceId: string;
  staleReason: string;
  pipelineStage: string;
  status: string;
  lastActivityAt?: string;
  consumerFirstName: string;
  consumerLastName: string;
  consumerPhone: string;
  consumerEmail?: string;
  serviceType: string;
  recommendedAction?: string;
  suggestedContactMessage?: string;
  preferredContactChannel?: string;
  aiSummary?: string;
}

export interface StaleLeadsResponse {
  items: StaleLeadItem[];
}

@Injectable({ providedIn: 'root' })
export class StaleLeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/stale`;

  list(limit = 20): Observable<StaleLeadsResponse> {
    const params = toHttpParams({ limit });
    return this.http.get<StaleLeadsResponse>(this.baseUrl, { params });
  }
}

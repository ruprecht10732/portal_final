import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { DraftApprovalsResponse } from './dashboard.types';
import { toHttpParams } from '../utils/http-utils';

@Injectable({ providedIn: 'root' })
export class DashboardDraftApprovalsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/quotes/pending-approval`;

  getDraftApprovals(page: number, pageSize: number): Observable<DraftApprovalsResponse> {
    const params = toHttpParams({ page, pageSize });
    return this.http.get<DraftApprovalsResponse>(this.baseUrl, { params });
  }
}

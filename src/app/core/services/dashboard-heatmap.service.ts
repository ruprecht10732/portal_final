import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LeadHeatmapResponse } from './dashboard.types';
import { toHttpParams } from '../utils/http-utils';

@Injectable({ providedIn: 'root' })
export class DashboardHeatmapService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/heatmap`;

  getHeatmap(startDate?: string, endDate?: string): Observable<LeadHeatmapResponse> {
    const params = toHttpParams({ startDate, endDate });
    return this.http.get<LeadHeatmapResponse>(this.baseUrl, { params });
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LeadHeatmapResponse } from './dashboard.types';

@Injectable({ providedIn: 'root' })
export class DashboardHeatmapService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/heatmap`;

  getHeatmap(startDate?: string, endDate?: string): Observable<LeadHeatmapResponse> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<LeadHeatmapResponse>(this.baseUrl, { params });
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { DashboardMetricsResponse } from './dashboard.types';

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/metrics`;

  getMetrics(): Observable<DashboardMetricsResponse> {
    return this.http.get<DashboardMetricsResponse>(this.baseUrl);
  }
}

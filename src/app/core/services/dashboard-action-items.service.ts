import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ActionItemsResponse } from './dashboard.types';

@Injectable({ providedIn: 'root' })
export class DashboardActionItemsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/action-items`;

  getActionItems(page: number, pageSize: number): Observable<ActionItemsResponse> {
    let params = new HttpParams();
    params = params.set('page', String(page));
    params = params.set('pageSize', String(pageSize));
    return this.http.get<ActionItemsResponse>(this.baseUrl, { params });
  }
}

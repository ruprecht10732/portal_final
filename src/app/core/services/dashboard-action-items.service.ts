import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ActionItemsResponse } from './dashboard.types';
import { toHttpParams } from '../utils/http-utils';

@Injectable({ providedIn: 'root' })
export class DashboardActionItemsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads/action-items`;

  getActionItems(page: number, pageSize: number): Observable<ActionItemsResponse> {
    const params = toHttpParams({ page, pageSize });
    return this.http.get<ActionItemsResponse>(this.baseUrl, { params });
  }
}

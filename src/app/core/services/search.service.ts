import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';
import type { GlobalSearchParams, SearchResponse } from './search.types';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/search`;

  globalSearch(params: GlobalSearchParams): Observable<SearchResponse> {
    const httpParams = toHttpParams({ q: params.q, limit: params.limit, types: params.types });
    return this.http.get<SearchResponse>(this.baseUrl, { params: httpParams });
  }
}

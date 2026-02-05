import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BaseCrudService } from './base-crud.service';
import { toHttpParams } from '../utils/http-utils';
import type {
  Partner,
  PartnerListResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  ListPartnersParams,
} from './partners.types';

@Injectable({ providedIn: 'root' })
export class PartnersService extends BaseCrudService<
  Partner,
  ListPartnersParams,
  PartnerListResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  { message: string }
> {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/partners`;

  list(params: ListPartnersParams = {}): Observable<PartnerListResponse> {
    const entries: Record<string, string | number | undefined | null> = {
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    return this.http.get<PartnerListResponse>(this.baseUrl, { params: toHttpParams(entries) });
  }

  getById(id: string): Observable<Partner> {
    return this.http.get<Partner>(`${this.baseUrl}/${id}`);
  }

  create(data: CreatePartnerRequest): Observable<Partner> {
    return this.http.post<Partner>(this.baseUrl, data);
  }

  update(id: string, data: UpdatePartnerRequest): Observable<Partner> {
    return this.http.put<Partner>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}

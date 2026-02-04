import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateServiceTypeRequest, DeleteServiceTypeResponse, ListServiceTypesParams, ReorderServiceTypesRequest, ServiceTypeItem, ServiceTypeListResponse, UpdateServiceTypeRequest } from './service-types.types';
import { normalizeIconName } from './icon-utils';
import { toHttpParams } from '../utils/http-utils';

@Injectable({ providedIn: 'root' })
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/service-types`;
  private readonly adminBaseUrl = `${environment.apiBaseUrl}/admin/service-types`;

  listActive(): Observable<ServiceTypeListResponse> {
    return this.http.get<ServiceTypeListResponse>(this.baseUrl).pipe(
      map(response => this.normalizeResponse(response)),
    );
  }

  getById(id: string): Observable<ServiceTypeItem> {
    return this.http.get<ServiceTypeItem>(`${this.baseUrl}/${id}`).pipe(
      map(item => this.normalizeItem(item)),
    );
  }

  listAdmin(params: ListServiceTypesParams = {}): Observable<ServiceTypeListResponse> {
    const httpParams = toHttpParams({
      search: params.search,
      isActive: params.isActive,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
    return this.http.get<ServiceTypeListResponse>(this.adminBaseUrl, { params: httpParams }).pipe(
      map(response => this.normalizeResponse(response)),
    );
  }

  create(request: CreateServiceTypeRequest): Observable<ServiceTypeItem> {
    return this.http.post<ServiceTypeItem>(this.adminBaseUrl, request).pipe(
      map(item => this.normalizeItem(item)),
    );
  }

  update(id: string, request: UpdateServiceTypeRequest): Observable<ServiceTypeItem> {
    return this.http.put<ServiceTypeItem>(`${this.adminBaseUrl}/${id}`, request).pipe(
      map(item => this.normalizeItem(item)),
    );
  }

  delete(id: string): Observable<DeleteServiceTypeResponse> {
    return this.http.delete<DeleteServiceTypeResponse>(`${this.adminBaseUrl}/${id}`);
  }

  toggleActive(id: string): Observable<ServiceTypeItem> {
    return this.http.patch<ServiceTypeItem>(`${this.adminBaseUrl}/${id}/toggle-active`, {}).pipe(
      map(item => this.normalizeItem(item)),
    );
  }

  reorder(request: ReorderServiceTypesRequest): Observable<void> {
    return this.http.put<void>(`${this.adminBaseUrl}/reorder`, request);
  }

  private normalizeItem(item: ServiceTypeItem): ServiceTypeItem {
    const normalizedIcon = normalizeIconName(item.icon);
    if (normalizedIcon == null) {
      return item;
    }
    return {
      ...item,
      icon: normalizedIcon,
    };
  }

  private normalizeResponse(response: ServiceTypeListResponse): ServiceTypeListResponse {
    return {
      ...response,
      items: (response.items ?? []).map(item => this.normalizeItem(item)),
    };
  }
}

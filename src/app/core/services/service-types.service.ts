import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateServiceTypeRequest, DeleteServiceTypeResponse, ListServiceTypesParams, ServiceTypeItem, ServiceTypeListResponse, UpdateServiceTypeRequest } from './service-types.types';
import { normalizeIconName } from './icon-utils';
import { toHttpParams } from '../utils/http-utils';

@Injectable({ providedIn: 'root' })
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/service-types`;
  private readonly adminBaseUrl = `${environment.apiBaseUrl}/admin/service-types`;
  private activeListCache: ServiceTypeListResponse | null = null;
  private activeListRequest: Observable<ServiceTypeListResponse> | null = null;

  listActive(): Observable<ServiceTypeListResponse> {
    if (this.activeListCache) {
      return of(this.activeListCache);
    }
    if (this.activeListRequest) {
      return this.activeListRequest;
    }

    this.activeListRequest = this.http.get<ServiceTypeListResponse>(this.baseUrl).pipe(
      map(response => this.normalizeResponse(response)),
      tap(response => {
        this.activeListCache = response;
      }),
      finalize(() => {
        this.activeListRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.activeListRequest;
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
      tap(() => this.clearActiveListCache()),
    );
  }

  update(id: string, request: UpdateServiceTypeRequest): Observable<ServiceTypeItem> {
    return this.http.put<ServiceTypeItem>(`${this.adminBaseUrl}/${id}`, request).pipe(
      map(item => this.normalizeItem(item)),
      tap(() => this.clearActiveListCache()),
    );
  }

  delete(id: string): Observable<DeleteServiceTypeResponse> {
    return this.http.delete<DeleteServiceTypeResponse>(`${this.adminBaseUrl}/${id}`).pipe(
      tap(() => this.clearActiveListCache()),
    );
  }

  toggleActive(id: string): Observable<ServiceTypeItem> {
    return this.http.patch<ServiceTypeItem>(`${this.adminBaseUrl}/${id}/toggle-active`, {}).pipe(
      map(item => this.normalizeItem(item)),
      tap(() => this.clearActiveListCache()),
    );
  }

  private clearActiveListCache(): void {
    this.activeListCache = null;
    this.activeListRequest = null;
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

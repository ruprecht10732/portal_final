import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateServiceTypeRequest, ReorderServiceTypesRequest, ServiceTypeItem, ServiceTypeListResponse, UpdateServiceTypeRequest } from './service-types.types';

@Injectable({ providedIn: 'root' })
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/service-types`;
  private readonly adminBaseUrl = `${environment.apiBaseUrl}/admin/service-types`;

  listActive(): Observable<ServiceTypeListResponse> {
    return this.http.get<ServiceTypeListResponse>(this.baseUrl);
  }

  listAdmin(): Observable<ServiceTypeListResponse> {
    return this.http.get<ServiceTypeListResponse>(this.adminBaseUrl);
  }

  create(request: CreateServiceTypeRequest): Observable<ServiceTypeItem> {
    return this.http.post<ServiceTypeItem>(this.adminBaseUrl, request);
  }

  update(id: string, request: UpdateServiceTypeRequest): Observable<ServiceTypeItem> {
    return this.http.put<ServiceTypeItem>(`${this.adminBaseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminBaseUrl}/${id}`);
  }

  toggleActive(id: string): Observable<ServiceTypeItem> {
    return this.http.patch<ServiceTypeItem>(`${this.adminBaseUrl}/${id}/toggle-active`, {});
  }

  reorder(request: ReorderServiceTypesRequest): Observable<void> {
    return this.http.put<void>(`${this.adminBaseUrl}/reorder`, request);
  }
}

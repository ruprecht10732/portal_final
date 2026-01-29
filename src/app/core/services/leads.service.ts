import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  Lead,
  LeadListResponse,
  CreateLeadRequest,
  UpdateLeadRequest,
  UpdateStatusRequest,
  ScheduleVisitRequest,
  CompleteSurveyRequest,
  MarkNoShowRequest,
  DuplicateCheckResponse,
  ListLeadsParams,
} from './leads.types';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads`;

  list(params: ListLeadsParams = {}): Observable<LeadListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.serviceType) httpParams = httpParams.set('serviceType', params.serviceType);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);
    return this.http.get<LeadListResponse>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateLeadRequest): Observable<Lead> {
    return this.http.post<Lead>(this.baseUrl, data);
  }

  update(id: string, data: UpdateLeadRequest): Observable<Lead> {
    return this.http.put<Lead>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  updateStatus(id: string, data: UpdateStatusRequest): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${id}/status`, data);
  }

  scheduleVisit(id: string, data: ScheduleVisitRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/schedule`, data);
  }

  completeSurvey(id: string, data: CompleteSurveyRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/survey`, data);
  }

  markNoShow(id: string, data: MarkNoShowRequest = {}): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/no-show`, data);
  }

  markViewed(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/view`, {});
  }

  checkDuplicate(phone: string): Observable<DuplicateCheckResponse> {
    return this.http.get<DuplicateCheckResponse>(`${this.baseUrl}/check-duplicate`, {
      params: new HttpParams().set('phone', phone),
    });
  }
}

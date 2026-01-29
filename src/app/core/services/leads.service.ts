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
  RescheduleVisitRequest,
  CreateLeadNoteRequest,
  DuplicateCheckResponse,
  LeadNotesResponse,
  LeadNote,
  ListLeadsParams,
  BulkDeleteLeadsResponse,
  VisitHistoryListResponse,
  AddServiceRequest,
  UpdateServiceStatusRequest,
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

  bulkDelete(ids: string[]): Observable<BulkDeleteLeadsResponse> {
    return this.http.post<BulkDeleteLeadsResponse>(`${this.baseUrl}/bulk-delete`, { ids });
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

  markNoShow(id: string, data: MarkNoShowRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/no-show`, data);
  }

  rescheduleVisit(id: string, data: RescheduleVisitRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/reschedule`, data);
  }

  markViewed(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/view`, {});
  }

  listVisitHistory(id: string): Observable<VisitHistoryListResponse> {
    return this.http.get<VisitHistoryListResponse>(`${this.baseUrl}/${id}/visit-history`);
  }

  listNotes(id: string): Observable<LeadNotesResponse> {
    return this.http.get<LeadNotesResponse>(`${this.baseUrl}/${id}/notes`);
  }

  addNote(id: string, data: CreateLeadNoteRequest): Observable<LeadNote> {
    return this.http.post<LeadNote>(`${this.baseUrl}/${id}/notes`, data);
  }

  assign(id: string, assigneeId: string | null): Observable<Lead> {
    return this.http.put<Lead>(`${this.baseUrl}/${id}/assign`, { assigneeId });
  }

  checkDuplicate(phone: string): Observable<DuplicateCheckResponse> {
    return this.http.get<DuplicateCheckResponse>(`${this.baseUrl}/check-duplicate`, {
      params: new HttpParams().set('phone', phone),
    });
  }

  addService(id: string, data: AddServiceRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/services`, data);
  }

  updateServiceStatus(leadId: string, serviceId: string, data: UpdateServiceStatusRequest): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${leadId}/services/${serviceId}/status`, data);
  }
}

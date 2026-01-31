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
  ReturningCustomerResponse,
  LeadNotesResponse,
  LeadNote,
  ListLeadsParams,
  BulkDeleteLeadsResponse,
  VisitHistoryListResponse,
  AddServiceRequest,
  UpdateServiceStatusRequest,
  LeadAIAnalysisResponse,
  LeadAIAnalysisListResponse,
  AnalyzeLeadResponse,
} from './leads.types';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads`;

  list(params: ListLeadsParams = {}): Observable<LeadListResponse> {
    return this.http.get<LeadListResponse>(this.baseUrl, { params: this.buildListParams(params) });
  }

  private buildListParams(params: ListLeadsParams): HttpParams {
    let httpParams = new HttpParams();
    const entries: Record<string, string | number | undefined | null> = {
      status: params.status,
      serviceType: params.serviceType,
      search: params.search,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      email: params.email,
      role: params.role,
      street: params.street,
      houseNumber: params.houseNumber,
      zipCode: params.zipCode,
      city: params.city,
      assignedAgentId: params.assignedAgentId,
      createdAtFrom: params.createdAtFrom,
      createdAtTo: params.createdAtTo,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
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

  checkReturningCustomer(phone: string, email?: string): Observable<ReturningCustomerResponse> {
    let params = new HttpParams();
    if (phone) {
      params = params.set('phone', phone);
    }
    if (email) {
      params = params.set('email', email);
    }
    return this.http.get<ReturningCustomerResponse>(`${this.baseUrl}/check-returning-customer`, { params });
  }

  addService(id: string, data: AddServiceRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/services`, data);
  }

  updateServiceStatus(leadId: string, serviceId: string, data: UpdateServiceStatusRequest): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${leadId}/services/${serviceId}/status`, data);
  }

  // AI Analysis methods
  analyzeWithAI(id: string, force = false): Observable<AnalyzeLeadResponse> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post<AnalyzeLeadResponse>(`${this.baseUrl}/${id}/analyze`, {}, { params });
  }

  getLatestAnalysis(id: string): Observable<LeadAIAnalysisResponse> {
    return this.http.get<LeadAIAnalysisResponse>(`${this.baseUrl}/${id}/analysis`);
  }

  listAnalyses(id: string): Observable<LeadAIAnalysisListResponse> {
    return this.http.get<LeadAIAnalysisListResponse>(`${this.baseUrl}/${id}/analysis/history`);
  }
}

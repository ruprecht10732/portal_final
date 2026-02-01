import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AppointmentAttachmentResponse,
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentVisitReportResponse,
  AvailabilityOverrideResponse,
  AvailabilityRuleResponse,
  CreateAppointmentAttachmentRequest,
  CreateAppointmentRequest,
  CreateAvailabilityOverrideRequest,
  CreateAvailabilityRuleRequest,
  ListAppointmentsParams,
  UpdateAppointmentRequest,
  UpdateAppointmentStatusRequest,
  UpsertVisitReportRequest,
} from './appointments.types';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/appointments`;

  list(params: ListAppointmentsParams = {}): Observable<AppointmentListResponse> {
    return this.http.get<AppointmentListResponse>(this.baseUrl, { params: this.buildListParams(params) });
  }

  getById(id: string): Observable<AppointmentResponse> {
    return this.http.get<AppointmentResponse>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateAppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>(this.baseUrl, data);
  }

  update(id: string, data: UpdateAppointmentRequest): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(`${this.baseUrl}/${id}`, data);
  }

  updateStatus(id: string, data: UpdateAppointmentStatusRequest): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(`${this.baseUrl}/${id}/status`, data);
  }

  getVisitReport(id: string): Observable<AppointmentVisitReportResponse> {
    return this.http.get<AppointmentVisitReportResponse>(`${this.baseUrl}/${id}/visit-report`);
  }

  upsertVisitReport(id: string, data: UpsertVisitReportRequest): Observable<AppointmentVisitReportResponse> {
    return this.http.put<AppointmentVisitReportResponse>(`${this.baseUrl}/${id}/visit-report`, data);
  }

  listAttachments(id: string): Observable<AppointmentAttachmentResponse[]> {
    return this.http.get<AppointmentAttachmentResponse[]>(`${this.baseUrl}/${id}/attachments`);
  }

  createAttachment(id: string, data: CreateAppointmentAttachmentRequest): Observable<AppointmentAttachmentResponse> {
    return this.http.post<AppointmentAttachmentResponse>(`${this.baseUrl}/${id}/attachments`, data);
  }

  listAvailabilityRules(userId?: string): Observable<AvailabilityRuleResponse[]> {
    return this.http.get<AvailabilityRuleResponse[]>(`${this.baseUrl}/availability/rules`, {
      params: this.buildAvailabilityParams({ userId }),
    });
  }

  createAvailabilityRule(data: CreateAvailabilityRuleRequest): Observable<AvailabilityRuleResponse> {
    return this.http.post<AvailabilityRuleResponse>(`${this.baseUrl}/availability/rules`, data);
  }

  deleteAvailabilityRule(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/availability/rules/${id}`);
  }

  listAvailabilityOverrides(params: { userId?: string; startDate?: string; endDate?: string } = {}): Observable<AvailabilityOverrideResponse[]> {
    return this.http.get<AvailabilityOverrideResponse[]>(`${this.baseUrl}/availability/overrides`, {
      params: this.buildAvailabilityParams(params),
    });
  }

  createAvailabilityOverride(data: CreateAvailabilityOverrideRequest): Observable<AvailabilityOverrideResponse> {
    return this.http.post<AvailabilityOverrideResponse>(`${this.baseUrl}/availability/overrides`, data);
  }

  deleteAvailabilityOverride(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/availability/overrides/${id}`);
  }

  private buildListParams(params: ListAppointmentsParams): HttpParams {
    let httpParams = new HttpParams();
    const entries: Record<string, string | number | undefined | null> = {
      userId: params.userId,
      leadId: params.leadId,
      type: params.type,
      status: params.status,
      startFrom: params.startFrom,
      startTo: params.startTo,
      page: params.page,
      pageSize: params.pageSize,
    };

    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }

  private buildAvailabilityParams(params: { userId?: string; startDate?: string; endDate?: string }): HttpParams {
    let httpParams = new HttpParams();
    const entries: Record<string, string | undefined> = {
      userId: params.userId,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    for (const [key, value] of Object.entries(entries)) {
      if (!value) continue;
      httpParams = httpParams.set(key, value);
    }

    return httpParams;
  }
}

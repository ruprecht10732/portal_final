import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';
import type {
  AppointmentAttachmentResponse,
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentVisitReportResponse,
  AvailabilityOverrideResponse,
  AvailabilityRuleResponse,
  AvailableSlotsResponse,
  CreateAppointmentAttachmentRequest,
  CreateAppointmentRequest,
  CreateAvailabilityOverrideRequest,
  CreateAvailabilityRuleRequest,
  GetAvailableSlotsParams,
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

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
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
      params: this.buildAvailabilityParams({ ...(userId !== undefined && { userId }) }),
    });
  }

  createAvailabilityRule(data: CreateAvailabilityRuleRequest): Observable<AvailabilityRuleResponse> {
    return this.http.post<AvailabilityRuleResponse>(`${this.baseUrl}/availability/rules`, data);
  }

  updateAvailabilityRule(id: string, data: Partial<CreateAvailabilityRuleRequest>): Observable<AvailabilityRuleResponse> {
    return this.http.put<AvailabilityRuleResponse>(`${this.baseUrl}/availability/rules/${id}`, data);
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

  updateAvailabilityOverride(id: string, data: Partial<CreateAvailabilityOverrideRequest>): Observable<AvailabilityOverrideResponse> {
    return this.http.put<AvailabilityOverrideResponse>(`${this.baseUrl}/availability/overrides/${id}`, data);
  }

  deleteAvailabilityOverride(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/availability/overrides/${id}`);
  }

  getAvailableSlots(params: GetAvailableSlotsParams): Observable<AvailableSlotsResponse> {
    const httpParams = toHttpParams({
      startDate: params.startDate,
      endDate: params.endDate,
      userId: params.userId,
      slotDuration: params.slotDuration,
    });
    return this.http.get<AvailableSlotsResponse>(`${this.baseUrl}/availability/slots`, { params: httpParams });
  }

  private buildListParams(params: ListAppointmentsParams) {
    const entries: Record<string, string | number | undefined | null> = {
      userId: params.userId,
      leadId: params.leadId,
      type: params.type,
      status: params.status,
      startFrom: params.startFrom,
      startTo: params.startTo,
      search: params.search,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      page: params.page,
      pageSize: params.pageSize,
    };

    return toHttpParams(entries);
  }

  private buildAvailabilityParams(params: { userId?: string; startDate?: string; endDate?: string }) {
    const entries: Record<string, string | undefined> = {
      userId: params.userId,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    return toHttpParams(entries);
  }
}

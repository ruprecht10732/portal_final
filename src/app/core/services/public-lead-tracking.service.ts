import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AddInfoRequest,
  AvailableSlotsResponse,
  ConfirmUploadRequest,
  PresignUploadRequest,
  PresignUploadResponse,
  PublicLeadTrackingResponse,
  RequestAppointmentRequest,
  RequestAppointmentResponse,
  UpdatePreferencesRequest,
} from './public-lead-tracking.types';

/**
 * Service for public (unauthenticated) lead tracking portal endpoints.
 * These calls use the /public/leads/:token routes — no JWT required.
 */
@Injectable({ providedIn: 'root' })
export class PublicLeadTrackingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/public/leads`;

  /** Fetch public track & trace data by token */
  getByToken(token: string): Observable<PublicLeadTrackingResponse> {
    return this.http.get<PublicLeadTrackingResponse>(`${this.baseUrl}/${encodeURIComponent(token)}`);
  }

  /** Update customer preferences */
  updatePreferences(token: string, data: UpdatePreferencesRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.baseUrl}/${encodeURIComponent(token)}/preferences`,
      data,
    );
  }

  /** Add extra customer info */
  addInfo(token: string, data: AddInfoRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/${encodeURIComponent(token)}/info`, data);
  }

  /** Request a presigned upload URL */
  presignUpload(token: string, data: PresignUploadRequest): Observable<PresignUploadResponse> {
    return this.http.post<PresignUploadResponse>(
      `${this.baseUrl}/${encodeURIComponent(token)}/attachments/presign`,
      data,
    );
  }

  /** Confirm file upload */
  confirmUpload(token: string, data: ConfirmUploadRequest): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.baseUrl}/${encodeURIComponent(token)}/attachments`,
      data,
    );
  }

  /** Delete an uploaded attachment */
  deleteAttachment(token: string, attachmentId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(
      `${this.baseUrl}/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }

  /** Fetch available inspection slots */
  getAvailableSlots(token: string, startDate: string, endDate: string, slotDuration = 60): Observable<AvailableSlotsResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('slotDuration', String(slotDuration));
    return this.http.get<AvailableSlotsResponse>(
      `${this.baseUrl}/${encodeURIComponent(token)}/availability/slots`,
      { params },
    );
  }

  /** Request an inspection appointment */
  requestAppointment(token: string, data: RequestAppointmentRequest): Observable<RequestAppointmentResponse> {
    return this.http.post<RequestAppointmentResponse>(
      `${this.baseUrl}/${encodeURIComponent(token)}/appointments/request`,
      data,
    );
  }
}

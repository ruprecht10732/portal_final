import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BaseCrudService } from './base-crud.service';
import { toHttpParams } from '../utils/http-utils';
import type {
  Lead,
  LeadListResponse,
  CreateLeadRequest,
  UpdateLeadRequest,
  UpdateStatusRequest,
  CreateLeadNoteRequest,
  DuplicateCheckResponse,
  ReturningCustomerResponse,
  LeadNotesResponse,
  LeadNote,
  ListLeadsParams,
  BulkDeleteLeadsResponse,
  AddServiceRequest,
  UpdateServiceStatusRequest,
  UpdateServiceTypeRequest,
  LeadAIAnalysisResponse,
  LeadAIAnalysisListResponse,
  AnalyzeLeadResponse,
  LogCallRequest,
  LogCallResponse,
  PresignedUploadRequest,
  PresignedUploadResponse,
  CreateAttachmentRequest,
  Attachment,
  AttachmentListResponse,
  PresignedDownloadResponse,
  PhotoAnalysisResponse,
  LeadTimelineResponse,
} from './leads.types';

@Injectable({ providedIn: 'root' })
export class LeadsService extends BaseCrudService<
  Lead,
  ListLeadsParams,
  LeadListResponse,
  CreateLeadRequest,
  UpdateLeadRequest,
  { message: string }
> {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/leads`;

  list(params: ListLeadsParams = {}): Observable<LeadListResponse> {
    return this.http.get<LeadListResponse>(this.baseUrl, { params: this.buildListParams(params) });
  }

  private buildListParams(params: ListLeadsParams) {
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

    return toHttpParams(entries);
  }

  getById(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  getTimeline(id: string, serviceId?: string): Observable<LeadTimelineResponse> {
    const params: Record<string, string> = {};
    if (serviceId) {
      params['serviceId'] = serviceId;
    }
    return this.http.get<LeadTimelineResponse>(`${this.baseUrl}/${id}/timeline`, { params });
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

  markViewed(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/view`, {});
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
      params: toHttpParams({ phone }),
    });
  }

  checkReturningCustomer(phone: string, email?: string): Observable<ReturningCustomerResponse> {
    const params = toHttpParams({ phone, email });
    return this.http.get<ReturningCustomerResponse>(`${this.baseUrl}/check-returning-customer`, { params });
  }

  addService(id: string, data: AddServiceRequest): Observable<Lead> {
    return this.http.post<Lead>(`${this.baseUrl}/${id}/services`, data);
  }

  updateServiceStatus(leadId: string, serviceId: string, data: UpdateServiceStatusRequest): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${leadId}/services/${serviceId}/status`, data);
  }

  updateServiceType(leadId: string, serviceId: string, data: UpdateServiceTypeRequest): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${leadId}/services/${serviceId}/type`, data);
  }

  // AI Analysis methods
  analyzeWithAI(id: string, serviceId: string, force = false): Observable<AnalyzeLeadResponse> {
    const params = toHttpParams({ serviceId, force: force ? true : undefined });
    return this.http.post<AnalyzeLeadResponse>(`${this.baseUrl}/${id}/analyze`, {}, { params });
  }

  getLatestAnalysis(id: string, serviceId: string): Observable<LeadAIAnalysisResponse> {
    const params = toHttpParams({ serviceId });
    return this.http.get<LeadAIAnalysisResponse>(`${this.baseUrl}/${id}/analysis`, { params });
  }

  listAnalyses(id: string, serviceId: string): Observable<LeadAIAnalysisListResponse> {
    const params = toHttpParams({ serviceId });
    return this.http.get<LeadAIAnalysisListResponse>(`${this.baseUrl}/${id}/analysis/history`, { params });
  }

  // Photo Analysis - AI vision analysis of lead images
  getPhotoAnalysis(leadId: string, serviceId: string): Observable<PhotoAnalysisResponse> {
    return this.http.get<PhotoAnalysisResponse>(`${this.baseUrl}/${leadId}/services/${serviceId}/photo-analysis`);
  }

  triggerPhotoAnalysis(leadId: string, serviceId: string, context?: string): Observable<{ status: string; message: string; photoCount: number }> {
    return this.http.post<{ status: string; message: string; photoCount: number }>(
      `${this.baseUrl}/${leadId}/services/${serviceId}/analyze-photos`,
      { context: context ?? '' },
    );
  }

  // Call Logger - processes post-call summaries into structured actions
  logCall(leadId: string, serviceId: string, data: LogCallRequest): Observable<LogCallResponse> {
    return this.http.post<LogCallResponse>(`${this.baseUrl}/${leadId}/services/${serviceId}/log-call`, data);
  }

  // Attachment methods for lead service file uploads
  getPresignedUploadUrl(leadId: string, serviceId: string, data: PresignedUploadRequest): Observable<PresignedUploadResponse> {
    return this.http.post<PresignedUploadResponse>(
      `${this.baseUrl}/${leadId}/services/${serviceId}/attachments/presign`,
      data
    );
  }

  createAttachment(leadId: string, serviceId: string, data: CreateAttachmentRequest): Observable<Attachment> {
    return this.http.post<Attachment>(`${this.baseUrl}/${leadId}/services/${serviceId}/attachments`, data);
  }

  listAttachments(leadId: string, serviceId: string): Observable<AttachmentListResponse> {
    return this.http.get<AttachmentListResponse>(`${this.baseUrl}/${leadId}/services/${serviceId}/attachments`);
  }

  getAttachment(leadId: string, serviceId: string, attachmentId: string): Observable<Attachment> {
    return this.http.get<Attachment>(`${this.baseUrl}/${leadId}/services/${serviceId}/attachments/${attachmentId}`);
  }

  getAttachmentDownloadUrl(leadId: string, serviceId: string, attachmentId: string): Observable<PresignedDownloadResponse> {
    return this.http.get<PresignedDownloadResponse>(
      `${this.baseUrl}/${leadId}/services/${serviceId}/attachments/${attachmentId}/download`
    );
  }

  deleteAttachment(leadId: string, serviceId: string, attachmentId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${leadId}/services/${serviceId}/attachments/${attachmentId}`
    );
  }

  /**
   * Upload a file to MinIO via presigned URL workflow:
   * 1. Get presigned URL from backend
   * 2. Upload file directly to MinIO
   * 3. Create attachment record in database
   */
  uploadFile(leadId: string, serviceId: string, file: File): Observable<Attachment> {
    return this.getPresignedUploadUrl(leadId, serviceId, {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }).pipe(
      switchMap(presigned =>
        this.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
          switchMap(() =>
            this.createAttachment(leadId, serviceId, {
              fileKey: presigned.fileKey,
              fileName: file.name,
              contentType: file.type,
              sizeBytes: file.size,
            })
          )
        )
      )
    );
  }

  private uploadToPresignedUrl(uploadUrl: string, file: File): Observable<void> {
    return new Observable(observer => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next();
          observer.complete();
          return;
        }
        observer.error(new Error(`Upload failed with status ${xhr.status}`));
      };

      xhr.onerror = () => observer.error(new Error('Upload failed'));
      xhr.send(file);
    });
  }
}

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
  CreateLeadNoteRequest,
  DuplicateCheckResponse,
  ReturningCustomerResponse,
  LeadNotesResponse,
  LeadNote,
  ListLeadsParams,
  BulkDeleteLeadsResponse,
  AddServiceRequest,
  UpdateServiceStatusRequest,
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
  analyzeWithAI(id: string, serviceId: string, force = false): Observable<AnalyzeLeadResponse> {
    let params = new HttpParams().set('serviceId', serviceId);
    if (force) {
      params = params.set('force', 'true');
    }
    return this.http.post<AnalyzeLeadResponse>(`${this.baseUrl}/${id}/analyze`, {}, { params });
  }

  getLatestAnalysis(id: string, serviceId: string): Observable<LeadAIAnalysisResponse> {
    const params = new HttpParams().set('serviceId', serviceId);
    return this.http.get<LeadAIAnalysisResponse>(`${this.baseUrl}/${id}/analysis`, { params });
  }

  listAnalyses(id: string, serviceId: string): Observable<LeadAIAnalysisListResponse> {
    const params = new HttpParams().set('serviceId', serviceId);
    return this.http.get<LeadAIAnalysisListResponse>(`${this.baseUrl}/${id}/analysis/history`, { params });
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
    return new Observable(observer => {
      // Step 1: Get presigned URL
      this.getPresignedUploadUrl(leadId, serviceId, {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }).subscribe({
        next: presigned => {
          // Step 2: Upload to MinIO using presigned URL
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presigned.uploadUrl, true);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Step 3: Create attachment record
              this.createAttachment(leadId, serviceId, {
                fileKey: presigned.fileKey,
                fileName: file.name,
                contentType: file.type,
                sizeBytes: file.size,
              }).subscribe({
                next: attachment => {
                  observer.next(attachment);
                  observer.complete();
                },
                error: err => observer.error(err),
              });
            } else {
              observer.error(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => observer.error(new Error('Upload failed'));
          xhr.send(file);
        },
        error: err => observer.error(err),
      });
    });
  }
}

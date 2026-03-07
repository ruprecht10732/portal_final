import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';
import type {
  QuoteResponse,
  QuoteListResponse,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  QuoteStatus,
  QuoteCalculationRequest,
  QuoteCalculationResponse,
  AnnotationResponse,
  QuoteActivityResponse,
  QuotePreviewLinkResponse,
  PresignAttachmentUploadRequest,
  PresignedUploadResponse,
  PresignedDownloadResponse,
  GenerateQuoteRequest,
  GenerateQuoteAcceptedResponse,
  GenerateQuoteJobResponse,
  GenerateQuoteJobsListResponse,
  ExternalAccountingProvider,
  ProviderIntegrationStatusResponse,
  MoneybirdAuthorizeURLResponse,
  QuoteExportResponse,
  QuoteExportStatusResponse,
  BulkQuoteExportRequest,
  BulkQuoteExportResponse,
  CreateQuoteFeedbackRequest,
  QuoteFeedbackResponse,
} from './quotes.types';

/**
 * Service for quotes (offertes) — real HTTP calls to the Go backend.
 */
@Injectable({ providedIn: 'root' })
export class QuotesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/quotes`;

  /** List all quotes with optional filters */
  list(params: {
    leadId?: string;
    status?: string;
    search?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    validUntilFrom?: string;
    validUntilTo?: string;
    totalFrom?: string;
    totalTo?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
  } = {}): Observable<QuoteListResponse> {
    return this.http.get<QuoteListResponse>(this.baseUrl, {
      params: toHttpParams(params),
    });
  }

  /** Get a single quote by ID */
  getById(id: string): Observable<QuoteResponse> {
    return this.http.get<QuoteResponse>(`${this.baseUrl}/${id}`);
  }

  /** Create a new quote */
  create(data: CreateQuoteRequest): Observable<QuoteResponse> {
    return this.http.post<QuoteResponse>(this.baseUrl, data);
  }

  /** Update an existing quote */
  update(id: string, data: UpdateQuoteRequest): Observable<QuoteResponse> {
    return this.http.put<QuoteResponse>(`${this.baseUrl}/${id}`, data);
  }

  /** Update the status of a quote */
  updateStatus(id: string, status: QuoteStatus): Observable<QuoteResponse> {
    return this.http.patch<QuoteResponse>(`${this.baseUrl}/${id}/status`, { status });
  }

  /** Link/replace the lead service for a quote (used for Accepted quotes that are otherwise immutable). */
  setLeadServiceId(id: string, leadServiceId: string): Observable<QuoteResponse> {
    return this.http.patch<QuoteResponse>(`${this.baseUrl}/${id}/lead-service`, { leadServiceId });
  }

  /** Delete a quote */
  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  /** Preview calculation — server-side totals without persisting */
  calculate(data: QuoteCalculationRequest): Observable<QuoteCalculationResponse> {
    return this.http.post<QuoteCalculationResponse>(`${this.baseUrl}/calculate`, data);
  }

  /** Send a quote proposal to the lead via magic link */
  send(id: string): Observable<QuoteResponse> {
    return this.http.post<QuoteResponse>(`${this.baseUrl}/${id}/send`, {});
  }

  /** Get (or create) a read-only preview link token for a quote */
  getPreviewLink(id: string): Observable<QuotePreviewLinkResponse> {
    return this.http.get<QuotePreviewLinkResponse>(`${this.baseUrl}/${id}/preview-link`);
  }

  /** Add an agent annotation to a quote item */
  annotateItem(quoteId: string, itemId: string, text: string): Observable<AnnotationResponse> {
    return this.http.post<AnnotationResponse>(
      `${this.baseUrl}/${quoteId}/items/${itemId}/annotations`,
      { text },
    );
  }

  /** Get the persisted activity history for a quote */
  getActivities(quoteId: string): Observable<QuoteActivityResponse[]> {
    return this.http.get<QuoteActivityResponse[]>(`${this.baseUrl}/${quoteId}/activities`);
  }

  /** Download the quote PDF as a blob */
  downloadPdf(quoteId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${quoteId}/pdf`, {
      responseType: 'blob',
    });
  }

  /** Get a presigned URL for uploading a manual attachment PDF */
  presignAttachmentUpload(quoteId: string, data: PresignAttachmentUploadRequest): Observable<PresignedUploadResponse> {
    return this.http.post<PresignedUploadResponse>(`${this.baseUrl}/${quoteId}/attachments/presign`, data);
  }

  /** Upload a file to a presigned URL (direct to object storage) */
  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<void> {
    return this.http.put<void>(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
    });
  }

  /** Get a presigned download URL for an attachment (supports catalog + manual sources) */
  getAttachmentDownloadUrl(quoteId: string, attachmentId: string): Observable<PresignedDownloadResponse> {
    return this.http.get<PresignedDownloadResponse>(`${this.baseUrl}/${quoteId}/attachments/${attachmentId}/download`);
  }

  /** Generate a draft quote from a user prompt using the AI agent pipeline */
  generate(data: GenerateQuoteRequest): Observable<GenerateQuoteAcceptedResponse> {
    return this.http.post<unknown>(`${this.baseUrl}/generate`, data).pipe(
      map((response) => this.normalizeGenerateAcceptedResponse(response)),
    );
  }

  /** Get status/progress for an async quote generation job */
  getGenerateJob(jobId: string): Observable<GenerateQuoteJobResponse> {
    return this.http.get<unknown>(`${this.baseUrl}/generate-jobs/${jobId}`).pipe(
      map((response) => this.normalizeGenerateJobResponse(response)),
    );
  }

  /** List async quote generation jobs for the current user */
  listGenerateJobs(params: { page?: number; limit?: number } = {}): Observable<GenerateQuoteJobsListResponse> {
    return this.http.get<unknown>(`${this.baseUrl}/generate-jobs`, {
      params: toHttpParams(params),
    }).pipe(
      map((response) => this.normalizeGenerateJobsListResponse(response)),
    );
  }

  /** Delete a finished (completed/failed) async quote generation job */
  deleteGenerateJob(jobId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.baseUrl}/generate-jobs/${jobId}`);
  }

  /** Cancel an active async quote generation job */
  cancelGenerateJob(jobId: string): Observable<GenerateQuoteJobResponse> {
    return this.http.post<unknown>(`${this.baseUrl}/generate-jobs/${jobId}/cancel`, {}).pipe(
      map((response) => this.normalizeGenerateJobResponse(response)),
    );
  }

  /** Clear all completed async quote generation jobs for the current user */
  clearCompletedGenerateJobs(): Observable<{ status: string; deleted: number }> {
    return this.http.delete<{ status: string; deleted: number }>(`${this.baseUrl}/generate-jobs/completed`);
  }

  getProviderIntegrationStatus(provider: ExternalAccountingProvider): Observable<ProviderIntegrationStatusResponse> {
    return this.http.get<ProviderIntegrationStatusResponse>(`${this.baseUrl}/integrations/${provider}/status`);
  }

  getMoneybirdAuthorizeURL(): Observable<MoneybirdAuthorizeURLResponse> {
    return this.http.get<MoneybirdAuthorizeURLResponse>(`${this.baseUrl}/integrations/moneybird/authorize-url`);
  }

  disconnectProvider(provider: ExternalAccountingProvider): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.baseUrl}/integrations/${provider}`);
  }

  exportQuoteToProvider(quoteId: string, provider: ExternalAccountingProvider): Observable<QuoteExportResponse> {
    return this.http.post<QuoteExportResponse>(`${this.baseUrl}/${quoteId}/export/${provider}`, {});
  }

  submitFeedback(quoteId: string, data: CreateQuoteFeedbackRequest): Observable<QuoteFeedbackResponse> {
    return this.http.post<QuoteFeedbackResponse>(`${this.baseUrl}/${quoteId}/feedback`, data);
  }

  getQuoteExportStatus(quoteId: string, provider: ExternalAccountingProvider): Observable<QuoteExportStatusResponse> {
    return this.http.get<QuoteExportStatusResponse>(`${this.baseUrl}/${quoteId}/export/${provider}/status`);
  }

  bulkExportQuotesToProvider(provider: ExternalAccountingProvider, data: BulkQuoteExportRequest): Observable<BulkQuoteExportResponse> {
    return this.http.post<BulkQuoteExportResponse>(`${this.baseUrl}/export/${provider}/bulk`, data);
  }

  private normalizeGenerateAcceptedResponse(input: unknown): GenerateQuoteAcceptedResponse {
    const source = (input ?? {}) as Record<string, unknown>;
    const jobId = this.readString(source, 'jobId') ?? this.readString(source, 'job_id') ?? '';
    const status = this.normalizeGenerateStatus(this.readString(source, 'status'));

    return {
      jobId,
      status,
    };
  }

  private normalizeGenerateJobResponse(input: unknown): GenerateQuoteJobResponse {
    const source = (input ?? {}) as Record<string, unknown>;

    const readString = (camel: string, snake: string): string | undefined =>
      this.readString(source, camel) ?? this.readString(source, snake);

    const readNumber = (camel: string, snake: string): number | undefined =>
      this.readNumber(source, camel) ?? this.readNumber(source, snake);

    const error = readString('error', 'error');
    const quoteId = readString('quoteId', 'quote_id');
    const quoteNumber = readString('quoteNumber', 'quote_number');
    const itemCount = readNumber('itemCount', 'item_count');
    const finishedAt = readString('finishedAt', 'finished_at');

    const normalized: GenerateQuoteJobResponse = {
      jobId: readString('jobId', 'job_id') ?? '',
      status: this.normalizeGenerateStatus(readString('status', 'status')),
      step: readString('step', 'step') ?? '',
      progressPercent: readNumber('progressPercent', 'progress_percent') ?? 0,
      leadId: readString('leadId', 'lead_id') ?? '',
      leadServiceId: readString('leadServiceId', 'lead_service_id') ?? '',
      startedAt: readString('startedAt', 'started_at') ?? '',
      updatedAt: readString('updatedAt', 'updated_at') ?? '',
    };

    if (error !== undefined) normalized.error = error;
    if (quoteId !== undefined) normalized.quoteId = quoteId;
    if (quoteNumber !== undefined) normalized.quoteNumber = quoteNumber;
    if (typeof itemCount === 'number') normalized.itemCount = itemCount;
    if (finishedAt !== undefined) normalized.finishedAt = finishedAt;

    return normalized;
  }

  private normalizeGenerateJobsListResponse(input: unknown): GenerateQuoteJobsListResponse {
    const source = (input ?? {}) as Record<string, unknown>;
    const itemsSource = source['items'];
    const totalSource = source['total'];
    const pageSource = source['page'];

    const items: GenerateQuoteJobResponse[] = Array.isArray(itemsSource)
      ? itemsSource.map(item => this.normalizeGenerateJobResponse(item))
      : [];

    return {
      items,
      total: typeof totalSource === 'number' ? totalSource : items.length,
      page: typeof pageSource === 'number' ? pageSource : 1,
    };
  }

  private normalizeGenerateStatus(value: string | undefined): GenerateQuoteAcceptedResponse['status'] {
    switch (value) {
      case 'pending':
      case 'running':
      case 'completed':
      case 'failed':
      case 'cancelled':
        return value;
      default:
        return 'pending';
    }
  }

  private readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private readNumber(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    return typeof value === 'number' ? value : undefined;
  }
}

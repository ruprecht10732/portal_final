import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
}

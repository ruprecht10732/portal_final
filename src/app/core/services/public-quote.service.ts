import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  PublicQuoteResponse,
  ToggleItemResponse,
  AnnotationResponse,
  AcceptQuoteRequest,
  RejectQuoteRequest,
} from './quotes.types';

/**
 * Service for public (unauthenticated) quote proposal endpoints.
 * These calls use the /public/quotes/:token routes — no JWT required.
 */
@Injectable({ providedIn: 'root' })
export class PublicQuoteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/public/quotes`;

  /** Fetch the public quote by magic-link token */
  getByToken(token: string): Observable<PublicQuoteResponse> {
    return this.http.get<PublicQuoteResponse>(`${this.baseUrl}/${token}`);
  }

  /** Toggle an optional line item on/off */
  toggleItem(token: string, itemId: string, isSelected: boolean): Observable<ToggleItemResponse> {
    return this.http.patch<ToggleItemResponse>(
      `${this.baseUrl}/${token}/items/${itemId}/toggle`,
      { isSelected },
    );
  }

  /** Add an annotation (question/comment) to a line item */
  annotateItem(token: string, itemId: string, text: string): Observable<AnnotationResponse> {
    return this.http.post<AnnotationResponse>(
      `${this.baseUrl}/${token}/items/${itemId}/annotations`,
      { text },
    );
  }

  /** Update an annotation (question/comment) on a line item */
  updateAnnotation(token: string, itemId: string, annotationId: string, text: string): Observable<AnnotationResponse> {
    return this.http.patch<AnnotationResponse>(
      `${this.baseUrl}/${token}/items/${itemId}/annotations/${annotationId}`,
      { text },
    );
  }

  /** Delete an annotation (question/comment) from a line item */
  deleteAnnotation(token: string, itemId: string, annotationId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${token}/items/${itemId}/annotations/${annotationId}`,
    );
  }

  /** Accept the quote with digital signature */
  accept(token: string, data: AcceptQuoteRequest): Observable<PublicQuoteResponse> {
    return this.http.post<PublicQuoteResponse>(`${this.baseUrl}/${token}/accept`, data);
  }

  /** Reject the quote */
  reject(token: string, data: RejectQuoteRequest): Observable<PublicQuoteResponse> {
    return this.http.post<PublicQuoteResponse>(`${this.baseUrl}/${token}/reject`, data);
  }

  /** Download the quote PDF as a blob */
  downloadPdf(token: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${token}/pdf`, {
      responseType: 'blob',
    });
  }
}

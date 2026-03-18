import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  PublicPartnerOfferResponse,
  AcceptOfferRequest,
  RejectOfferRequest,
  PartnerOfferTermsResponse,
} from './partner-offer.types';

/**
 * Service for public (unauthenticated) partner-offer endpoints.
 * Uses /public/partner-offers/:token routes — no JWT required.
 */
@Injectable({ providedIn: 'root' })
export class PublicPartnerOfferService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/public/partner-offers`;

  /** Fetch the public offer by magic-link token. */
  getByToken(token: string): Observable<PublicPartnerOfferResponse> {
    return this.http.get<PublicPartnerOfferResponse>(`${this.baseUrl}/${token}`);
  }

  getTerms(token: string): Observable<PartnerOfferTermsResponse> {
    return this.http.get<PartnerOfferTermsResponse>(`${this.baseUrl}/${token}/terms`);
  }

  /** Accept the offer with availability slots. */
  accept(token: string, payload: AcceptOfferRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${token}/accept`, payload);
  }

  /** Reject the offer with optional reason. */
  reject(token: string, payload: RejectOfferRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${token}/reject`, payload);
  }

  buildPhotoUrl(token: string, attachmentId: string): string {
    return `${this.baseUrl}/${token}/photos/${attachmentId}`;
  }

  buildPdfUrl(token: string): string {
    return `${this.baseUrl}/${token}/pdf`;
  }

  waitForPdfReady(token: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      const stream = new EventSource(`${this.baseUrl}/${token}/pdf-ready`);

      const handleReady = () => {
        subscriber.next();
        subscriber.complete();
        stream.close();
      };

      const handleTimeout = () => {
        subscriber.error(new Error('pdf timeout'));
        stream.close();
      };

      const handleError = () => {
        subscriber.error(new Error('pdf stream error'));
        stream.close();
      };

      stream.addEventListener('ready', handleReady);
      stream.addEventListener('timeout', handleTimeout);
      stream.onerror = handleError;

      return () => {
        stream.removeEventListener('ready', handleReady);
        stream.removeEventListener('timeout', handleTimeout);
        stream.close();
      };
    });
  }
}

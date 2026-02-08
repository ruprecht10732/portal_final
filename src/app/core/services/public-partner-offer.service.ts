import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  PublicPartnerOfferResponse,
  AcceptOfferRequest,
  RejectOfferRequest,
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

  /** Accept the offer with availability slots. */
  accept(token: string, payload: AcceptOfferRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${token}/accept`, payload);
  }

  /** Reject the offer with optional reason. */
  reject(token: string, payload: RejectOfferRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${token}/reject`, payload);
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BaseCrudService } from './base-crud.service';
import { toHttpParams } from '../utils/http-utils';
import type {
  Partner,
  PartnerListResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  ListPartnersParams,
  PartnerLogoPresignRequest,
  PartnerLogoPresignResponse,
  SetPartnerLogoRequest,
  PartnerLogoDownloadResponse,
  CreateOfferFromQuoteRequest,
  CreateOfferResponse,
  ListOffersResponse,
  ListOffersParams,
  OfferListResponse,
} from './partners.types';
import type {
  PublicPartnerOfferResponse,
  OfferDetailResponse,
  PartnerOfferTermsHistoryResponse,
  PartnerOfferTermsResponse,
  UpdatePartnerOfferTermsRequest,
} from './partner-offer.types';

@Injectable({ providedIn: 'root' })
export class PartnersService extends BaseCrudService<
  Partner,
  ListPartnersParams,
  PartnerListResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  { message: string }
> {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/partners`;

  list(params: ListPartnersParams = {}): Observable<PartnerListResponse> {
    const entries: Record<string, string | number | undefined | null> = {
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    return this.http.get<PartnerListResponse>(this.baseUrl, { params: toHttpParams(entries) });
  }

  getById(id: string): Observable<Partner> {
    return this.http.get<Partner>(`${this.baseUrl}/${id}`);
  }

  create(data: CreatePartnerRequest): Observable<Partner> {
    return this.http.post<Partner>(this.baseUrl, data);
  }

  update(id: string, data: UpdatePartnerRequest): Observable<Partner> {
    return this.http.put<Partner>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  presignLogo(id: string, request: PartnerLogoPresignRequest): Observable<PartnerLogoPresignResponse> {
    return this.http.post<PartnerLogoPresignResponse>(`${this.baseUrl}/${id}/logo/presign`, request);
  }

  setLogo(id: string, request: SetPartnerLogoRequest): Observable<Partner> {
    return this.http.post<Partner>(`${this.baseUrl}/${id}/logo`, request);
  }

  getLogoDownloadUrl(id: string): Observable<PartnerLogoDownloadResponse> {
    return this.http.get<PartnerLogoDownloadResponse>(`${this.baseUrl}/${id}/logo/download`);
  }

  deleteLogo(id: string): Observable<Partner> {
    return this.http.delete<Partner>(`${this.baseUrl}/${id}/logo`);
  }

  // ── Offers ──────────────────────────────────────────────────────────────

  createOfferFromQuote(data: CreateOfferFromQuoteRequest): Observable<CreateOfferResponse> {
    return this.http.post<CreateOfferResponse>(`${this.baseUrl}/offers/from-quote`, data);
  }

  listServiceOffers(serviceId: string): Observable<ListOffersResponse> {
    return this.http.get<ListOffersResponse>(`${this.baseUrl}/services/${serviceId}/offers`);
  }



  listOffers(params: ListOffersParams = {}): Observable<OfferListResponse> {
    const entries: Record<string, string | number | undefined | null> = {
      search: params.search,
      status: params.status,
      partnerId: params.partnerId,
      leadServiceId: params.leadServiceId,
      serviceTypeId: params.serviceTypeId,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    return this.http.get<OfferListResponse>(`${this.baseUrl}/offers`, { params: toHttpParams(entries) });
  }

  deleteOffer(offerId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/offers/${offerId}`);
  }
  listPartnerOffers(partnerId: string): Observable<ListOffersResponse> {
    return this.http.get<ListOffersResponse>(`${this.baseUrl}/${partnerId}/offers`);
  }

  linkLead(partnerId: string, leadId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${partnerId}/leads`, { leadId });
  }

  /** Fetch what the vakman sees (authenticated preview for admin users). */
  previewOffer(offerId: string): Observable<PublicPartnerOfferResponse> {
    return this.http.get<PublicPartnerOfferResponse>(`${this.baseUrl}/offers/${offerId}/preview`);
  }

  getOfferDetail(offerId: string): Observable<OfferDetailResponse> {
    return this.http.get<OfferDetailResponse>(`${this.baseUrl}/offers/${offerId}/detail`);
  }

  getOfferTerms(): Observable<PartnerOfferTermsResponse> {
    return this.http.get<PartnerOfferTermsResponse>(`${this.baseUrl}/offer-terms`);
  }

  updateOfferTerms(data: UpdatePartnerOfferTermsRequest): Observable<PartnerOfferTermsResponse> {
    return this.http.put<PartnerOfferTermsResponse>(`${this.baseUrl}/offer-terms`, data);
  }

  listOfferTermsHistory(): Observable<PartnerOfferTermsHistoryResponse> {
    return this.http.get<PartnerOfferTermsHistoryResponse>(`${this.baseUrl}/offer-terms/history`);
  }

  buildPreviewOfferPhotoUrl(offerId: string, attachmentId: string): string {
    return `${this.baseUrl}/offers/${offerId}/photos/${attachmentId}`;
  }

  /**
   * Build the public acceptance URL for a given offer token.
   * This URL is the page the vakman visits to accept/reject the offer.
   */
  buildOfferAcceptanceUrl(publicToken: string): string {
    return `${globalThis.location.origin}/partner-offer/${publicToken}`;
  }

  /**
   * Compose a WhatsApp `wa.me` URL pre-filled with an offer message
   * that includes the acceptance link.
   */
  buildOfferWhatsAppUrl(phone: string, partnerName: string, publicToken: string, priceCents: number): string {
    const cleanPhone = phone.replaceAll(/\D/g, '');
    const acceptanceUrl = this.buildOfferAcceptanceUrl(publicToken);
    const priceFormatted = (priceCents / 100).toLocaleString('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
    const message = [
      `Hallo ${partnerName},`,
      '',
      `Er is een nieuw werkaanbod voor u beschikbaar ter waarde van ${priceFormatted}.`,
      '',
      'Bekijk het aanbod en geef uw beschikbaarheid door via onderstaande link:',
      acceptanceUrl,
      '',
      'Met vriendelijke groet',
    ].join('\n');

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
}

/** Response from the public partner-offer endpoint (no auth needed). */
export interface PublicPartnerOfferResponse {
  offerId: string;
  organizationName: string;
  jobSummary: string;
  jobSummaryShort?: string | null;
  builderSummary?: string | null;
  city: string;
  postcode4?: string | null;
  buurtcode?: string | null;
  constructionYear?: number | null;
  scopeAssessment?: string | null;
  urgencyLevel?: string | null;
  vakmanPriceCents: number;
  pricingSource: 'quote' | 'estimate';
  status: PartnerOfferStatus;
  expiresAt: string;
  createdAt: string;
  leadContact?: PublicPartnerOfferLeadContact | null;
  lineItems?: PublicPartnerOfferLineItem[];
  photos?: OfferPhotoRef[];
  requiresInspection?: boolean;
}

export interface PublicPartnerOfferLeadContact {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PublicPartnerOfferLineItem {
  description: string;
  quantity: string;
}

export interface OfferPhotoRef {
  id: string;
  fileName: string;
  contentType: string;
}

export interface PartnerOfferTermsResponse {
  content: string;
  version: number;
  createdAt?: string | null;
  createdByUserId?: string | null;
}

export interface PartnerOfferTermsHistoryItem {
  id: string;
  content: string;
  version: number;
  createdAt: string;
  createdByUserId?: string | null;
}

export interface PartnerOfferTermsHistoryResponse {
  items: PartnerOfferTermsHistoryItem[];
}

export interface UpdatePartnerOfferTermsRequest {
  content: string;
}

export type PartnerOfferStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

/** Time slot for inspection / job availability. */
export interface TimeSlot {
  start: string;
  end: string;
}

/** Payload the vakman sends when accepting an offer. */
export interface AcceptOfferRequest {
  inspectionSlots?: TimeSlot[];
  jobSlots?: TimeSlot[];
  signerFullName?: string;
  signerBusinessName?: string;
  signerAddress?: string;
  signatureData?: string;
}

/** Payload the vakman sends when rejecting an offer. */
export interface RejectOfferRequest {
  reason?: string;
}

/** Admin detail view of an accepted offer – what was sent AND accepted. */
export interface OfferDetailResponse {
  offerId: string;
  publicToken: string;
  status: PartnerOfferStatus;
  partnerName: string;
  organizationName: string;
  serviceType: string;
  leadCity?: string | null;
  pricingSource: string;
  customerPriceCents: number;
  vakmanPriceCents: number;
  requiresInspection: boolean;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  builderSummary?: string | null;
  jobSummaryShort?: string | null;
  lineItems?: OfferDetailLineItem[] | null;
  inspectionSlots?: TimeSlot[] | null;
  jobSlots?: TimeSlot[] | null;
  signerName?: string | null;
  signerBusinessName?: string | null;
  signerAddress?: string | null;
  pdfFileKey?: string | null;
  photos?: OfferPhotoRef[] | null;
}

export interface OfferDetailLineItem {
  description: string;
  quantity: string;
  unitPriceCents: number;
  lineTotalCents: number;
}

/** Helper: convert cents to euros display string. */
export function centsToEuros(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

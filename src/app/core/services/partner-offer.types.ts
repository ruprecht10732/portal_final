/** Response from the public partner-offer endpoint (no auth needed). */
export interface PublicPartnerOfferResponse {
  offerId: string;
  organizationName: string;
  jobSummary: string;
  city: string;
  vakmanPriceCents: number;
  pricingSource: 'quote' | 'estimate';
  status: PartnerOfferStatus;
  expiresAt: string;
  createdAt: string;
}

export type PartnerOfferStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

/** Time slot for inspection / job availability. */
export interface TimeSlot {
  start: string;
  end: string;
}

/** Payload the vakman sends when accepting an offer. */
export interface AcceptOfferRequest {
  inspectionSlots: TimeSlot[];
  jobSlots?: TimeSlot[] | undefined;
}

/** Payload the vakman sends when rejecting an offer. */
export interface RejectOfferRequest {
  reason?: string | undefined;
}

/** Helper: convert cents to euros display string. */
export function centsToEuros(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

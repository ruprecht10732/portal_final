export interface Partner {
  id: string;
  businessName: string;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  houseNumber?: string | null;
  postalCode: string;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  whatsappOptedIn: boolean;
  logoFileKey?: string | null;
  logoFileName?: string | null;
  logoContentType?: string | null;
  logoSizeBytes?: number | null;
  serviceTypeIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PartnerListResponse {
  items: Partner[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreatePartnerRequest {
  businessName: string;
  kvkNumber?: string;
  vatNumber?: string;
  addressLine1: string;
  addressLine2?: string | null;
  houseNumber?: string | null;
  postalCode: string;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  whatsappOptedIn?: boolean;
  serviceTypeIds?: string[];
}

export interface UpdatePartnerRequest {
  businessName?: string;
  kvkNumber?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  houseNumber?: string | null;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappOptedIn?: boolean;
  serviceTypeIds?: string[];
}

export interface PartnerLogoPresignRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PartnerLogoPresignResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: number;
}

export interface SetPartnerLogoRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PartnerLogoDownloadResponse {
  downloadUrl: string;
  expiresAt: number;
}

export interface ListPartnersParams {
  search?: string;
  sortBy?: 'businessName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ── Partner Offers (authenticated / dispatcher) ─────────────────────────

export interface CreateOfferFromQuoteRequest {
  partnerId: string;
  quoteId: string;
  expiresInHours: number;
  jobSummaryShort?: string;
  marginBasisPoints?: number;
  vakmanPriceCents?: number;
  selectedItemIds?: string[];
  requiresInspection?: boolean;
}

export interface CreateOfferResponse {
  id: string;
  publicToken: string;
  vakmanPriceCents: number;
  expiresAt: string;
}

export interface OfferResponse {
  id: string;
  partnerId: string;
  partnerName: string;
  serviceType?: string;
  serviceTypeId?: string;
  leadCity?: string;
  leadServiceId: string;
  pricingSource: string;
  customerPriceCents: number;
  vakmanPriceCents: number;
  status: string;
  publicToken: string;
  expiresAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface ListOffersResponse {
  items: OfferResponse[];
}

export interface ListOffersParams {
  search?: string;
  status?: 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';
  partnerId?: string;
  leadServiceId?: string;
  serviceTypeId?: string;
  sortBy?: 'createdAt' | 'expiresAt' | 'status' | 'partnerName' | 'serviceType' | 'vakmanPriceCents' | 'customerPriceCents';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface OfferListResponse {
  items: OfferResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


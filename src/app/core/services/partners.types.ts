export interface Partner {
  id: string;
  businessName: string;
  kvkNumber: string;
  vatNumber: string;
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
  kvkNumber: string;
  vatNumber: string;
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

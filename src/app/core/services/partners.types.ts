export interface Partner {
  id: string;
  businessName: string;
  kvkNumber: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
  postalCode: string;
  city: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export interface UpdatePartnerRequest {
  businessName?: string;
  kvkNumber?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  postalCode?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ListPartnersParams {
  search?: string;
  sortBy?: 'businessName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

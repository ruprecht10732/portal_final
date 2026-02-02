export interface ServiceTypeItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  intakeGuidelines?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceTypeRequest {
  name: string;
  description?: string;
  intakeGuidelines?: string;
  icon?: string;
  color?: string;
  displayOrder?: number;
}

export interface UpdateServiceTypeRequest {
  name?: string;
  description?: string | null;
  intakeGuidelines?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number | null;
}

export interface ReorderServiceTypesRequest {
  items: { id: string; displayOrder: number }[];
}

export interface ServiceTypeListResponse {
  items: ServiceTypeItem[];
  total: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface DeleteServiceTypeResponse {
  status: 'deleted' | 'deactivated';
}

export interface ListServiceTypesParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'slug' | 'displayOrder' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

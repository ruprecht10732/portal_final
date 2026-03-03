export interface ServiceTypeItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  intakeGuidelines?: string;
  estimationGuidelines?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceTypeRequest {
  name: string;
  description?: string;
  intakeGuidelines?: string;
  estimationGuidelines?: string;
  icon?: string;
  color?: string;
}

export interface UpdateServiceTypeRequest {
  name?: string;
  description?: string | null;
  intakeGuidelines?: string | null;
  estimationGuidelines?: string | null;
  icon?: string | null;
  color?: string | null;
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
  sortBy?: 'name' | 'slug' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

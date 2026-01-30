export interface ServiceTypeItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
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
  icon?: string;
  color?: string;
  displayOrder?: number;
}

export interface UpdateServiceTypeRequest {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number | null;
}

export interface ReorderServiceTypesRequest {
  items: Array<{ id: string; displayOrder: number }>;
}

export interface ServiceTypeListResponse {
  items: ServiceTypeItem[];
  total: number;
}

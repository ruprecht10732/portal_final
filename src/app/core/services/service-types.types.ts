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

export interface ServiceTypeListResponse {
  items: ServiceTypeItem[];
  total: number;
}

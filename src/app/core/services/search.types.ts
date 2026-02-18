export type SearchEntityType = 'lead' | 'quote' | 'partner' | 'appointment' | 'catalog_product' | 'service_type';

export interface GlobalSearchParams {
  q: string;
  limit?: number;
  types?: string;
}

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  preview?: string;
  status: string;
  link: string;
  score: number;
  matchedField: string;
  createdAt: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}

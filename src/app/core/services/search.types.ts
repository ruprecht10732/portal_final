export type SearchEntityType = 'lead' | 'quote' | 'partner' | 'appointment';

export interface GlobalSearchParams {
  q: string;
  limit?: number;
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

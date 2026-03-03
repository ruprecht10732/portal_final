export interface DashboardMetricsResponse {
  activeLeads: number;
  quotePipelineCents: number;
  conversionRate: number;
  avgQuoteValueCents: number;
  activeLeadsTrend?: number[];
  quotePipelineTrendCents?: number[];
  conversionRateTrend?: number[];
  avgQuoteValueTrendCents?: number[];
}

export interface LeadHeatmapPoint {
  latitude: number;
  longitude: number;
}

export interface LeadHeatmapResponse {
  points: LeadHeatmapPoint[];
}

export interface ActionItem {
  id: string;
  name: string;
  urgencyReason?: string;
  createdAt: string;
  isUrgent: boolean;
}

export interface ActionItemsResponse {
  items: ActionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DraftApprovalItem {
  quoteId: string;
  leadId: string;
  quoteNumber: string;
  consumerName: string;
  totalCents: number;
  confidenceScore?: number;
  createdAt: string;
}

export interface DraftApprovalsResponse {
  items: DraftApprovalItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

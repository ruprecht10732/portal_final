export interface DashboardMetricsResponse {
  totalLeads: number;
  projectedValueCents: number;
  disqualifiedRate: number;
  touchpointsPerLead: number;
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

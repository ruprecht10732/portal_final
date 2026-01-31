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

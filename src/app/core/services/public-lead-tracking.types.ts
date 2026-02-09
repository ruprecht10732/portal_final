export interface PublicLeadTrackingResponse {
  consumerName: string;
  city: string;
  serviceType: string;
  createdAt: string;
  preferences: LeadPreferences;
  status: LeadStatus;
  appointment: AppointmentSummary | null;
  quote: QuoteSummary;
}

export interface LeadPreferences {
  budget?: string;
  timeframe?: string;
  availability?: string;
  extraNotes?: string;
}

export interface LeadStatus {
  label: string;
  description: string;
  step: number;
}

export interface AppointmentSummary {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
}

export interface QuoteSummary {
  available: boolean;
  status: string;
  link?: string;
  downloadLink?: string;
}

export interface UpdatePreferencesRequest {
  budget?: string;
  timeframe?: string;
  availability?: string;
  extraNotes?: string;
}

export interface AddInfoRequest {
  text: string;
}

export interface PresignUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignUploadResponse {
  uploadURL: string;
  fileKey: string;
  expiresAt: number;
}

export interface ConfirmUploadRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

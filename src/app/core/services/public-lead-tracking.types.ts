export interface PublicLeadTrackingResponse {
  consumerName: string;
  city: string;
  serviceType: string;
  createdAt: string;
  preferences: LeadPreferences;
  status: LeadStatus;
  appointment: AppointmentSummary | null;
  appointmentRequest: AppointmentSummary | null;
  slotsAvailable: boolean;
  quote: QuoteSummary;
  attachments: AttachmentSummary[];
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

export interface AvailableTimeSlot {
  userId: string;
  startTime: string;
  endTime: string;
}

export interface AvailableDaySlots {
  date: string;
  slots: AvailableTimeSlot[];
}

export interface AvailableSlotsResponse {
  days: AvailableDaySlots[];
}

export interface QuoteSummary {
  available: boolean;
  status: string;
  link?: string;
  downloadLink?: string;
}

export interface AttachmentSummary {
  id: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl?: string;
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
  uploadUrl: string;
  fileKey: string;
  expiresAt: number;
}

export interface ConfirmUploadRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RequestAppointmentRequest {
  userId: string;
  startTime: string;
  endTime: string;
}

export interface RequestAppointmentResponse {
  status: string;
  appointment: AppointmentSummary;
}

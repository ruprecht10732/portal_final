export type AppointmentType = 'lead_visit' | 'standalone' | 'blocked';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type AccessDifficulty = 'Low' | 'Medium' | 'High';

export interface AppointmentLeadInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

export interface AppointmentResponse {
  id: string;
  userId: string;
  leadId?: string;
  leadServiceId?: string;
  type: AppointmentType;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
  lead?: AppointmentLeadInfo;
}

export interface CreateAppointmentRequest {
  leadId?: string;
  leadServiceId?: string;
  type: AppointmentType;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  sendConfirmationEmail?: boolean;
}

export interface UpdateAppointmentRequest {
  title?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus;
}

export interface AppointmentListResponse {
  items: AppointmentResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AppointmentVisitReportResponse {
  appointmentId: string;
  measurements?: string;
  accessDifficulty?: AccessDifficulty;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertVisitReportRequest {
  measurements?: string;
  accessDifficulty?: AccessDifficulty;
  notes?: string;
}

export interface AppointmentAttachmentResponse {
  id: string;
  appointmentId: string;
  fileKey: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt: string;
}

export interface CreateAppointmentAttachmentRequest {
  fileKey: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface ListAppointmentsParams {
  userId?: string;
  leadId?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  startFrom?: string;
  startTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AvailabilityRuleResponse {
  id: string;
  userId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityRuleRequest {
  userId?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface AvailabilityOverrideResponse {
  id: string;
  userId: string;
  date: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityOverrideRequest {
  userId?: string;
  date: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

export const ACCESS_DIFFICULTY_OPTIONS: { label: string; value: AccessDifficulty }[] = [
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' },
];

// Availability slots types
export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DaySlots {
  date: string;
  slots: TimeSlot[];
}

export interface AvailableSlotsResponse {
  days: DaySlots[];
}

export interface GetAvailableSlotsParams {
  startDate: string;
  endDate: string;
  userId?: string;
  slotDuration?: number;
}

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
  meetingLink?: string;
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
  meetingLink?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  sendConfirmationEmail?: boolean;
}

export interface UpdateAppointmentRequest {
  title?: string;
  description?: string;
  location?: string;
  meetingLink?: string;
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
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'border-blue-500 bg-blue-50 text-blue-700',
  completed: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  cancelled: 'border-zinc-400 bg-zinc-50 text-zinc-500',
  no_show: 'border-red-500 bg-red-50 text-red-700',
};

export const APPOINTMENT_STATUS_I18N_KEYS: Record<AppointmentStatus, string> = {
  scheduled: 'appointments.status.scheduled',
  completed: 'appointments.status.completed',
  cancelled: 'appointments.status.cancelled',
  no_show: 'appointments.status.noShow',
};

export const buildAppointmentStatusLabels = (
  translate: (key: string) => string,
): Record<AppointmentStatus, string> => {
  const labels = {} as Record<AppointmentStatus, string>;
  (Object.keys(APPOINTMENT_STATUS_I18N_KEYS) as AppointmentStatus[]).forEach((status) => {
    const key = APPOINTMENT_STATUS_I18N_KEYS[status];
    labels[status] = translate(key) || status;
  });
  return labels;
};

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

// Lead types matching backend DTOs

export type ConsumerRole = 'Owner' | 'Tenant' | 'Landlord';
export type ServiceType = 'Windows' | 'Insulation' | 'Solar';
export type LeadStatus = 'New' | 'Attempted_Contact' | 'Scheduled' | 'Surveyed' | 'Bad_Lead' | 'Needs_Rescheduling';
export type AccessDifficulty = 'Low' | 'Medium' | 'High';

export interface Consumer {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: ConsumerRole;
}

export interface Address {
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
}

export interface Visit {
  scheduledDate?: string;
  scoutId?: string;
  measurements?: string;
  accessDifficulty?: AccessDifficulty;
  notes?: string;
  completedAt?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  consumer: Consumer;
  address: Address;
  serviceType: ServiceType;
  status: LeadStatus;
  assignedAgentId?: string | null;
  viewedById?: string;
  viewedAt?: string;
  visit: Visit;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  consumerRole: ConsumerRole;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  serviceType: ServiceType;
  assigneeId?: string | null;
}

export interface UpdateLeadRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  consumerRole?: ConsumerRole;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  serviceType?: ServiceType;
  status?: LeadStatus;
  assigneeId?: string | null;
}

export interface AssignLeadRequest {
  assigneeId?: string | null;
}

export interface UpdateStatusRequest {
  status: LeadStatus;
}

export interface ScheduleVisitRequest {
  scheduledDate: string;
  scoutId?: string;
}

export interface CompleteSurveyRequest {
  measurements: string;
  accessDifficulty: AccessDifficulty;
  notes?: string;
}

export interface MarkNoShowRequest {
  notes?: string;
}

export interface CreateLeadNoteRequest {
  body: string;
}

export interface LeadNotesResponse {
  items: LeadNote[];
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingLead?: Lead;
}

export interface BulkDeleteLeadsRequest {
  ids: string[];
}

export interface BulkDeleteLeadsResponse {
  deletedCount: number;
}

export interface ListLeadsParams {
  status?: LeadStatus;
  serviceType?: ServiceType;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
}

export type SortField = 'createdAt' | 'scheduledDate' | 'status' | 'firstName' | 'lastName';

// Status display helpers
export const STATUS_LABELS: Record<LeadStatus, string> = {
  New: 'New',
  Attempted_Contact: 'Attempted Contact',
  Scheduled: 'Scheduled',
  Surveyed: 'Surveyed',
  Bad_Lead: 'Bad Lead',
  Needs_Rescheduling: 'Needs Rescheduling',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  New: 'bg-blue-100 text-blue-800',
  Attempted_Contact: 'bg-yellow-100 text-yellow-800',
  Scheduled: 'bg-purple-100 text-purple-800',
  Surveyed: 'bg-green-100 text-green-800',
  Bad_Lead: 'bg-zinc-200 text-zinc-600',
  Needs_Rescheduling: 'bg-orange-100 text-orange-800',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  Windows: 'Windows',
  Insulation: 'Insulation',
  Solar: 'Solar',
};

export const CONSUMER_ROLE_OPTIONS: { label: string; value: ConsumerRole }[] = [
  { label: 'Owner', value: 'Owner' },
  { label: 'Tenant', value: 'Tenant' },
  { label: 'Landlord', value: 'Landlord' },
];

export const SERVICE_TYPE_OPTIONS: { label: string; value: ServiceType }[] = [
  { label: 'Windows', value: 'Windows' },
  { label: 'Insulation', value: 'Insulation' },
  { label: 'Solar', value: 'Solar' },
];

export const ACCESS_DIFFICULTY_OPTIONS: { label: string; value: AccessDifficulty }[] = [
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' },
];

export const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'New' },
  { label: 'Attempted Contact', value: 'Attempted_Contact' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Surveyed', value: 'Surveyed' },
  { label: 'Bad Lead', value: 'Bad_Lead' },
  { label: 'Needs Rescheduling', value: 'Needs_Rescheduling' },
];

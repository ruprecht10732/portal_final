// Lead types matching backend DTOs

export type ConsumerRole = 'Owner' | 'Tenant' | 'Landlord';
export type LeadStatus = 'New' | 'Attempted_Contact' | 'Scheduled' | 'Surveyed' | 'Bad_Lead' | 'Needs_Rescheduling' | 'Closed';
export type LeadNoteType = 'note' | 'call' | 'text' | 'email' | 'system';

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
  latitude?: number;
  longitude?: number;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  authorEmail: string;
  type: LeadNoteType;
  body: string;
  createdAt: string;
  updatedAt: string;
  consumerNote?: string;
  source?: string;
}

export interface LeadService {
  id: string;
  serviceType: string;
  status: LeadStatus;
  consumerNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  consumer: Consumer;
  address: Address;
  source?: string;
  services: LeadService[];
  currentService?: LeadService;
  aggregateStatus?: LeadStatus;
  assignedAgentId?: string | null;
  viewedById?: string;
  viewedAt?: string;
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
  latitude?: number;
  longitude?: number;
  serviceType: string;
  assigneeId?: string | null;
  consumerNote?: string;
  source?: string;
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
  latitude?: number;
  longitude?: number;
  assigneeId?: string | null;
}

export interface AddServiceRequest {
  serviceType: string;
  closeCurrentStatus?: boolean;
  consumerNote?: string;
  source?: string;
}

export interface UpdateServiceStatusRequest {
  status: LeadStatus;
}

export interface UpdateStatusRequest {
  status: LeadStatus;
}

export interface CreateLeadNoteRequest {
  body: string;
  type?: LeadNoteType;
}

export interface LeadNotesResponse {
  items: LeadNote[];
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingLead?: Lead;
}

// Returning customer detection
export interface ServiceBrief {
  serviceType: string;
  status: LeadStatus;
  createdAt: string;
}

export interface ReturningCustomerResponse {
  found: boolean;
  leadId?: string;
  fullName?: string;
  totalServices: number;
  services?: ServiceBrief[];
}

export interface BulkDeleteLeadsResponse {
  deletedCount: number;
}

export interface ListLeadsParams {
  status?: LeadStatus;
  serviceType?: string;
  search?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  role?: ConsumerRole;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  assignedAgentId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
}

export type SortField =
  | 'createdAt'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'role'
  | 'street'
  | 'houseNumber'
  | 'zipCode'
  | 'city'
  | 'assignedAgentId';

// Status display helpers
export const STATUS_LABELS: Record<LeadStatus, string> = {
  New: 'New',
  Attempted_Contact: 'Attempted Contact',
  Scheduled: 'Scheduled',
  Surveyed: 'Surveyed',
  Bad_Lead: 'Bad Lead',
  Needs_Rescheduling: 'Needs Rescheduling',
  Closed: 'Closed',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  New: 'bg-blue-100 text-blue-800',
  Attempted_Contact: 'bg-yellow-100 text-yellow-800',
  Scheduled: 'bg-purple-100 text-purple-800',
  Surveyed: 'bg-green-100 text-green-800',
  Bad_Lead: 'bg-zinc-200 text-zinc-600',
  Needs_Rescheduling: 'bg-orange-100 text-orange-800',
  Closed: 'bg-gray-100 text-gray-600',
};

export const CONSUMER_ROLE_OPTIONS: { label: string; value: ConsumerRole }[] = [
  { label: 'Owner', value: 'Owner' },
  { label: 'Tenant', value: 'Tenant' },
  { label: 'Landlord', value: 'Landlord' },
];

export const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'New' },
  { label: 'Attempted Contact', value: 'Attempted_Contact' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Surveyed', value: 'Surveyed' },
  { label: 'Bad Lead', value: 'Bad_Lead' },
  { label: 'Needs Rescheduling', value: 'Needs_Rescheduling' },
  { label: 'Closed', value: 'Closed' },
];

// AI Analysis types
export type UrgencyLevel = 'High' | 'Medium' | 'Low';
export type LeadQuality = 'Junk' | 'Low' | 'Potential' | 'High' | 'Urgent';
export type RecommendedAction = 'Reject' | 'RequestInfo' | 'ScheduleSurvey' | 'CallImmediately';
export type PreferredContactChannel = 'WhatsApp' | 'Email';

export interface LeadAIAnalysis {
  id: string;
  leadId: string;
  leadServiceId: string;
  urgencyLevel: UrgencyLevel;
  urgencyReason?: string | null;
  leadQuality: LeadQuality;
  recommendedAction: RecommendedAction;
  missingInformation: string[];
  preferredContactChannel: PreferredContactChannel;
  suggestedContactMessage: string;
  summary: string;
  createdAt: string;
}

export interface LeadAIAnalysisListResponse {
  items: LeadAIAnalysis[];
}

export interface LeadAIAnalysisResponse {
  analysis: LeadAIAnalysis;
  isDefault: boolean;
}

export interface AnalyzeLeadResponse {
  status: 'created' | 'no_change' | 'error';
  message: string;
  analysis?: LeadAIAnalysis;
}

// Call Logger types
export interface LogCallRequest {
  summary: string;
  sendConfirmationEmail?: boolean;
}

export interface LogCallResponse {
  noteCreated: boolean;
  statusUpdated?: string;
  appointmentBooked?: string; // ISO 8601 date string
  message: string;
}

// Attachment types for lead service file uploads
export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: number; // Unix timestamp
}

export interface CreateAttachmentRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface Attachment {
  id: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy?: string;
  createdAt: string;
  downloadUrl?: string;
}

// Alias for backward compatibility
export type LeadServiceAttachment = Attachment;

export interface AttachmentListResponse {
  items: Attachment[];
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresAt: number; // Unix timestamp
}

// Allowed file types for uploads
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav'],
} as const;

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.video,
  ...ALLOWED_FILE_TYPES.audio,
];

export const MAX_FILE_SIZE_BYTES = 104857600; // 100MB

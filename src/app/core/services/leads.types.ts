// Lead types matching backend DTOs

export type ConsumerRole = 'Owner' | 'Tenant' | 'Landlord';
export type LeadStatus = 'New' | 'Attempted_Contact' | 'Scheduled' | 'Surveyed' | 'Bad_Lead' | 'Needs_Rescheduling' | 'Closed';
export type PipelineStage =
  | 'Triage'
  | 'Nurturing'
  | 'Ready_For_Estimator'
  | 'Quote_Draft'
  | 'Quote_Sent'
  | 'Ready_For_Partner'
  | 'Partner_Matching'
  | 'Partner_Assigned'
  | 'Manual_Intervention'
  | 'Completed'
  | 'Lost';
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
  pipelineStage: PipelineStage;
  preferences?: LeadPreferences | null;
  consumerNote?: string;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadPreferences {
  budget?: string | null;
  timeframe?: string | null;
  availability?: string | null;
  extraNotes?: string | null;
}

export interface EnergyLabel {
  energieklasse: string;
  energieIndex?: number | null;
  bouwjaar?: number | null;
  geldigTot?: string | null;
  gebouwtype?: string | null;
  registratiedatum?: string | null;
  primaireFossieleEnergie?: number | null;
}

export interface LeadEnrichment {
  source?: string | null;
  postcode6?: string | null;
  buurtcode?: string | null;
  woningtypeCode?: string | null;
  bouwjaarklasseCode?: number | null;
  woningeigendomCode?: number | null;
  inkomenCode?: number | null;
  gemAardgasverbruik?: number | null;
  huishoudenGrootte?: number | null;
  koopwoningenPct?: number | null;
  bouwjaarVanaf2000Pct?: number | null;
  mediaanVermogenX1000?: number | null;
  huishoudensMetKinderenPct?: number | null;
  confidence?: number | null;
  fetchedAt?: string | null;
}

export interface LeadScore {
  score?: number | null;
  preAi?: number | null;
  factors?: Record<string, number> | null;
  version?: string | null;
  updatedAt?: string | null;
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
  energyLabel?: EnergyLabel | null;
  leadEnrichment?: LeadEnrichment | null;
  leadScore?: LeadScore | null;
  whatsappOptedIn: boolean;
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

export interface LeadTimelineItem {
  id: string;
  serviceId?: string;
  type: 'ai' | 'user' | 'stage';
  title: string;
  summary: string;
  timestamp: string;
  actor: string;
  metadata: LeadTimelineMetadata;
}

export type WhatsAppMessageStatus = 'sent' | 'draft' | 'failed';

export interface WhatsAppTimelineDrafts {
  whatsappMessage?: string;
  status?: WhatsAppMessageStatus;
  messageLanguage?: string;
  messageAudience?: string;
  messageCategory?: string;
  emailSubject?: string;
  emailBody?: string;
}

export interface WhatsAppTimelineMetadata {
  status?: WhatsAppMessageStatus;
  messageCategory?: string;
  messageAudience?: string;
  messageLanguage?: string;
  phoneNumber?: string;
  messageContent?: string;
  sentAt?: string;
  drafts?: WhatsAppTimelineDrafts;
  whatsappUrl?: string;
  preferredContactChannel?: 'WhatsApp' | 'Email';
  suggestedContactMessage?: string;
}

export type LeadTimelineMetadata = Record<string, unknown> & WhatsAppTimelineMetadata;

export interface LeadTimelineResponse {
  items: LeadTimelineItem[];
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
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  adLandingPage?: string;
  referrerUrl?: string;
  workflowId?: string;
  whatsappOptedIn?: boolean;
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
  whatsappOptedIn?: boolean;
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

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  Triage: 'Triage',
  Nurturing: 'Nurturing',
  Ready_For_Estimator: 'Ready for Estimator',
  Quote_Draft: 'Quote draft',
  Quote_Sent: 'Quote sent',
  Ready_For_Partner: 'Ready for Partner',
  Partner_Matching: 'Partner Matching',
  Partner_Assigned: 'Partner Assigned',
  Manual_Intervention: 'Manual Intervention',
  Completed: 'Completed',
  Lost: 'Lost',
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  Triage: 'bg-blue-100 text-blue-800',
  Nurturing: 'bg-amber-100 text-amber-800',
  Ready_For_Estimator: 'bg-indigo-100 text-indigo-800',
  Quote_Draft: 'bg-cyan-100 text-cyan-800',
  Quote_Sent: 'bg-teal-100 text-teal-800',
  Ready_For_Partner: 'bg-sky-100 text-sky-800',
  Partner_Matching: 'bg-purple-100 text-purple-800',
  Partner_Assigned: 'bg-emerald-100 text-emerald-800',
  Manual_Intervention: 'bg-red-100 text-red-800',
  Completed: 'bg-zinc-200 text-zinc-700',
  Lost: 'bg-zinc-200 text-zinc-600',
};

export const LEAD_STATUS_I18N_KEYS: Record<LeadStatus, string> = {
  New: 'leads.detail.status.new',
  Attempted_Contact: 'leads.detail.status.contacted',
  Scheduled: 'leads.detail.status.scheduled',
  Surveyed: 'leads.detail.status.completed',
  Bad_Lead: 'leads.detail.status.badLead',
  Needs_Rescheduling: 'leads.detail.status.needsRescheduling',
  Closed: 'leads.detail.status.closed',
};

export const buildLeadStatusLabels = (translate: (key: string) => string): Record<LeadStatus, string> => {
  const labels = {} as Record<LeadStatus, string>;
  (Object.keys(LEAD_STATUS_I18N_KEYS) as LeadStatus[]).forEach((status) => {
    const key = LEAD_STATUS_I18N_KEYS[status];
    const translated = translate(key);
    labels[status] = translated || STATUS_LABELS[status];
  });
  return labels;
};

export const PIPELINE_STAGE_I18N_KEYS: Record<PipelineStage, string> = {
  Triage: 'leads.pipeline.triage',
  Nurturing: 'leads.pipeline.nurturing',
  Ready_For_Estimator: 'leads.pipeline.readyForEstimator',
  Quote_Draft: 'leads.pipeline.quoteDraft',
  Quote_Sent: 'leads.pipeline.quoteSent',
  Ready_For_Partner: 'leads.pipeline.readyForPartner',
  Partner_Matching: 'leads.pipeline.partnerMatching',
  Partner_Assigned: 'leads.pipeline.partnerAssigned',
  Manual_Intervention: 'leads.pipeline.manualIntervention',
  Completed: 'leads.pipeline.completed',
  Lost: 'leads.pipeline.lost',
};

export const buildPipelineStageLabels = (translate: (key: string) => string): Record<PipelineStage, string> => {
  const labels = {} as Record<PipelineStage, string>;
  (Object.keys(PIPELINE_STAGE_I18N_KEYS) as PipelineStage[]).forEach((stage) => {
    const key = PIPELINE_STAGE_I18N_KEYS[stage];
    const translated = translate(key);
    labels[stage] = translated || PIPELINE_STAGE_LABELS[stage];
  });
  return labels;
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
  organizationId: string;
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

// Photo Analysis types
export type PhotoAnalysisConfidence = 'High' | 'Medium' | 'Low';
export type PhotoMeasurementType = 'dimension' | 'area' | 'count' | 'volume';

export interface PhotoMeasurement {
  description: string;
  value: number;
  unit: string;
  type: PhotoMeasurementType;
  confidence: PhotoAnalysisConfidence;
  photoRef: string;
}

export interface PhotoAnalysis {
  id: string;
  leadId: string;
  serviceId: string;
  summary: string;
  observations: string[];
  scopeAssessment: string;
  costIndicators: string;
  safetyConcerns: string[];
  additionalInfo: string[];
  confidenceLevel: PhotoAnalysisConfidence;
  photoCount: number;
  measurements: PhotoMeasurement[];
  needsOnsiteMeasurement: string[];
  discrepancies: string[];
  extractedText: string[];
  suggestedSearchTerms: string[];
  createdAt: string;
}

export interface PhotoAnalysisResponse {
  analysis: PhotoAnalysis | null;
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
